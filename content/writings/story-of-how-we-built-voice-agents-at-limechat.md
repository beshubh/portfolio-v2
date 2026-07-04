---
title: Story of how we built Voice Agents at LimeChat
date: 2026-05-11
summary: This post is a technical deep dive into how we built WhatsApp voice agents at LimeChat.
tags: [webrtc, voice-ai, rust]
status: published
---

This post is a technical deep dive into how we built WhatsApp voice agents at LimeChat.

We started with a Python + aiortc prototype to bridge WhatsApp Calling with our existing LiveKit-based Voice AI stack. That prototype helped us validate the product quickly, but once real traffic arrived, we hit serious CPU and scaling limits.

This post walks through the architecture of that bridge, the WebRTC and audio-processing problems we had to solve, where Python became the bottleneck, and why we eventually rewrote the core media bridge in Rust.

This post assumes you are already familiar with:

- WebRTC fundamentals such as SDP, ICE, media tracks, and codecs.
- `aiortc`, the Python implementation of WebRTC.
- LiveKit concepts such as rooms, participants, tracks, publish, and subscribe.
- Some Rust familiarity is useful, but not required.

**Problem**: In July 2025, Meta opened their API for WhatsApp Calling. At LimeChat, we were already handling millions of text conversations for clients like Mahindra and Taj Hotels, but voice was the new frontier. We had a working AI Voice Agent on LiveKit. We had users on WhatsApp. But, we didn’t have a bridge between two completely different real-time protocols that had no documentation on how to talk to each other.

Our backend stack is heavily Python-first, so the obvious move was to prototype this bridge in Python. In practice, that meant using `aiortc`, the only serious WebRTC implementation in the Python ecosystem, as our WebRTC endpoint on the server side. The first version of the bridge was therefore entirely built on `python + aiortc` .

**Infrastructure**
The team had zero prior experience with WebRTC. To build our Voice AI, we relied heavily on *[LiveKit](https://livekit.io)*. For the uninitiated, LiveKit abstracts away the complexities of WebRTC (ICE candidates, SFUs, packet routing) into a clean, room-based architecture.

The concept is simple:

- *A Room* acts as the central hub.
- *Participants* (Users, AI Agents, or Human Moderators) join the room.
- *Pub/Sub:* Anything a participant “publishes” (audio/video) is automatically “subscribed” to by everyone else in the room.

For a standard web call, this is plug-and-play. Drop in the JavaScript SDK for the user facing UI, Python SDK for the AI, and users can talk to the AI Agent immediately. LiveKit even handles SIP for traditional telephony.

**False assumption**
Naturally, we thought WhatsApp would be just another “participant.” The plan was straightforward:

1. Accept the incoming WhatsApp call.
2. Bridge the user into a LiveKit room.
3. Let the AI agent talk to the user.

It sounded simple. But, It wasn’t.
Unlike the web or SIP, WhatsApp doesn’t have a “LiveKit Adapter”. When we looked for documentation on bridging raw WhatsApp media streams to LiveKit, we found... nothing. No tutorials, no StackOverflow threads, no guides. (at least there was none when we started)

We were effectively trying to bridge a closed ecosystem (WhatsApp) to an open one (LiveKit) with no map, no WebRTC experts on the team, and a deadline approaching.

The first step was understanding the fundamental mismatch between the protocol and our use case.
WebRTC is designed as a *Peer-to-Peer (P2P)* protocol. When you call a friend on WhatsApp, your phone negotiates a direct connection with their phone. There is no central server processing the audio; it flows directly from device to device.

Since our AI lives on a server (not a browser), we could not connect Peer-to-Peer. We had to build a Python service that *acts* like a WebRTC peer to the WhatsApp user, terminates the media, and then pipes the media into LiveKit room.

- *To the WhatsApp User:* Our server looks like another phone answering the call.
- *To the Internal System:* Our server acts as a gateway, terminating the encrypted media stream, unpacking the audio, and forwarding it to our processing logic.

```
WhatsApp User <-> [Bridge]  <->  LiveKit Room <-> AI Agent
	(P2P)         (terminates)      (SFU)
```

We needed to do for hundreds of incoming P2P connections.

## Bridging WhatsApp and LiveKit

To successfully bridge a call, our architecture performs three distinct actions for every user:

1. *Impersonate a Participant:* Create a “virtual user” in the LiveKit room that represents the WhatsApp caller.
2. *Inbound Pipeline:* Capture the raw audio coming *from* WhatsApp, decode it, and publish it *to* the LiveKit room.
3. *Outbound Pipeline:* Subscribe to the AI’s audio in the LiveKit room, encode it, and stream it back *to* WhatsApp.

Since no documentation existed for this specific integration, we had to rely on reverse-engineering the packet flow. We identified three core components we needed to build from scratch:

**Signaling and Orchestration Server**

```
WhatsApp Call -> SDP Offer -> Bridge accepts -> ICE Connected -> Spin up LiveKit Room
```

Before any audio can flow, the connection must be established. This component handles the [SDP](https://webrtchacks.com/sdp-anatomy/) (Session Description Protocol) Negotiation.

- When a WhatsApp call comes in, this server performs the “handshake,” agreeing on codecs and encryption keys.
- Once the handshake is successful (`ICE Connection State: Connected`), it immediately initializes a dedicated `LiveKit Room` and prepares the bridge for media traffic.

**Inbound bridge (WhatsApp → LiveKit)**
Once the SDP negotiation completes, `aiortc` exposes the incoming media as a `MediaStreamTrack`. This is where the real work begins. We need to transcode the audio in real-time to make it compatible with LiveKit.

*The Transformation Pipeline:*

- *Source:* WhatsApp sends *48kHz Opus-encoded* audio.
- *Destination:* LiveKit expects raw *PCM* audio frames.

`aiortc` uses `PyAV` (python ffmpeg bindings) for the encoding/decoding, but working with it is very complicated due to scarce documentation, it is very tricky to get things right.

*The “Interleaved” Gotcha* One of the first hurdles we hit was understanding how PyAV exposes raw audio data. It returns a single, flat array of samples regardless of the channel count:

- **Mono:** `[S1, S2, S3, ...]`
- **Stereo:** `[L1, R1, L2, R2, ...]` (Interleaved)
We wrote a converter that takes these raw `av.AudioFrame` objects from PyAV, correctly parses the interleaved data, and repacks them into `rtc.AudioFrame` (LiveKit) objects that the LiveKit SDK understands.

*The Capture Loop*
Finally, to inject this audio into the room, we use a custom `rtc.AudioSource` attached to a `rtc.LocalAudioTrack` (of LiveKit). The entire process runs in an infinite `async` loop that does following steps.

1. `recv()` the next packet from WhatsApp (via `aiortc`).
2. Decode and repack the frame (via `PyAV`).
3. `capture_frame()` on (`rtc.AudioSource`) the frame into the LiveKit room.

> In theory, a simple `while True` loop works. But, in practice, doing this for 50 concurrent calls in python is very expensive. But for a prototype, this is enough.

**Outbound bridge (Livekit -> WhatsApp)**
For the reverse direction, we essentially mirror the inbound process. Once the LiveKit room setup is complete, we listen for the `track_subscribed` event. This gives us access to the AI agent’s audio track.

To feed this track back into the WebRTC connection, we implemented a custom class that inherits from `aiortc.AudioStreamTrack`. This inheritance is mandatory because the `aiortc` connection expects a valid media stream track object to read from.

Inside this custom class, we implemented a simple buffering mechanism:

- *Input:* Maintain an internal blocking queue (`asyncio.Queue`, channel in languages like Go, Rust). Whenever the LiveKit track emits a new `rtc.AudioFrame`, we push it directly into this queue.
- *Output:* `aiortc` automatically calls the `recv()` method on our track instance. Inside `recv()`, we pop the latest frame from the queue and convert it from LiveKit’s `rtc.AudioFrame` to PyAV’s `av.AudioFrame` format so it can be sent over the wire.

## when the prototype meets reality

Using `aiortc` was a great strategic choice for the prototype. It allowed us to ship fast, validate the product, and go live with minimal friction. But as soon as traffic started flowing, the reality of the implementation caught up with us.

We noticed that even 2-3 concurrent WhatsApp calls would cause significant CPU spikes. It became immediately clear that scaling this architecture to hundreds of calls would be very expensive if not impossible.

To prove it that python was the bottleneck, we did a small simulation of webrtc load from 50 to 300 concurrent calls on a single cpu core in two languages, `Rust` (compiled language I was familiar with) and `Python`, in each one of the scenarios (50, 100, 200, 300) python’s cpu usage shot up to 100% immediately while rust cruises stays steady around 15-20%, now `rust`‘s result were kind of expected but `python`‘s 100% usage was just too much.

![](https://substackcdn.com/image/fetch/$s_!rMC9!,w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F0a13e914-200a-4f75-b86a-64b1410433c2_1120x928.png)

*Why Rust?* Honest answer? Because I know Rust.
I could give you a breakdown of why we didn’t use Go(Unfamiliar), C++ (memory safety), or Zig (maturity), but the reality is simpler: We have a production fire and we need to rewrite the core infrastructure *now*, you pick the tool you are most familiar with. For me, that’s Rust.

It happened to be the perfect tool for the job.

## Problems that rust solves

**Some things that rust does better**
A common misunderstanding is treating Python’s asyncio as equivalent to true parallelism. They serve different purposes.

`asyncio` excels at *I/O-bound* concurrency — efficiently waiting for network packets, disk reads, database responses, etc., without blocking the event loop. But it provides *zero help* for *CPU-bound* work. Audio frame processing (decoding, format conversion, reshaping, sample-rate handling, repacking) is almost pure computation — arithmetic on arrays of samples. In Python, this math runs synchronously on the main thread and blocks the entire event loop until it completes.

In a real-time WebRTC bridge like ours, this becomes critical because frames arrive roughly every ~20 ms (Opus 20 ms packets at 48 kHz). Even small per-frame overhead accumulates rapidly across concurrent calls.

Consider typical Python bridge code running in tight while True / async loops:

```
# Inbound: WhatsApp → LiveKit
av_frame: av.AudioFrame = await self._track.recv()     # from aiortc
rtc_frame = rtc.AudioFrame(
    data=av_frame.to_ndarray().tobytes(), # heavy: ndarray alloc + copy + tobytes alloc + copy
    sample_rate=self._media_info.audio_sample_rate,
    num_channels=self._media_info.audio_channels,
    samples_per_channel=av_frame.samples,
)
await self.source.capture_frame(rtc_frame)  # publish to LiveKit
```

And the reverse direction:

```
# Outbound: LiveKit → WhatsApp
frame: rtc.AudioFrame = await asyncio.wait_for(self._queue.get(), timeout=0.02)
audio_data = np.frombuffer(frame.data, dtype=np.int16)  # buffer -> ndarray view (cheap)
reshaped = audio_data.reshape(1, -1) if mono else ...    # <-CPU cost: new array allocation + data copy
av_frame = av.AudioFrame.from_ndarray(
    reshaped,
    format="s16",
    layout="mono",
)
# then encode/send via aiortc
```

Each of the steps in above routines, incurs noticeable cost when repeated thousands of times per second across many calls:

- Frequent *small allocations* for intermediate buffers (to_ndarray(), tobytes(), reshaped views).
- *Data copies* between C land (FFmpeg/PyAV/LiveKit native) and Python land.
- *Context switching* overhead between Python interpreter and native extensions.

Every allocation doesn’t just consume memory - it costs CPU cycles. In a low-latency audio pipeline, these interruptions can introduce jitter, dropped frames, or force higher buffer sizes

Rust has some advantages for these issues explained above:

- Compiled native code.
- FFI calls are fundamentally faster because of the way rust handles FFI to C ( and we avoid python interpreter load as well)
- Zero copy & reuse buffer patterns are natural -- pre-allocate a reusable buffer (or use a ring buffer / pool), decode directly into it, transform in-place, and forward without new allocations per frame.
- it can achieve true parallelism when needed (Tokio + Rayon)
- the arithmetic that we are doing in our bridge it inherently faster in rust than in python.

With this proof in hand, we rewrote the bridge from `python + aiortc` to **Rust** and shipped it to production. The new implementation had an immediate effect: average CPU dropped by *10x*, while CPU spikes and memory usage became far more predictable. That translated directly into lower infra cost.

In the Python version, we typically needed *1GB RAM + 2 vCPU* Kubernetes pods, usually running *4–10 replicas*. With the Rust bridge, we run *~200MB RAM + 500m CPU* pods, averaging *2 replicas* and scaling to about *5* during spikes.

## What we learned

In hindsight, Python was exactly the right choice for the prototype, and Rust was exactly the right choice for production.

Python helped us answer the most important early question: “Can we make WhatsApp Calling talk to our LiveKit-based AI agent at all?” Once the answer was yes, Rust helped us answer the next question: “Can we do this reliably for hundreds of concurrent calls without burning infrastructure?”

That is the trade-off we would make again.

Prototype in the language that lets you build fastest. Rewrite the hot path only when production traffic proves where the bottleneck really is.
