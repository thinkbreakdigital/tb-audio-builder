# MIDI support

The Builder imports Standard MIDI Files and compiles the events it can represent into a
synthesized song. The parser is synchronous and does not write to the filesystem.

## Files and size limits

Accepted file extensions are `.mid` and `.midi`, from `SUPPORTED_MIDI_EXTENSIONS` in
`packages/midi-parser/src/constants.ts`. The maximum file size is `5 MB` (5,242,880 bytes), from
`MAX_MIDI_FILE_BYTES`.

## Events read by the Builder

| MIDI event              | Compiled result                                                      |
| ----------------------- | -------------------------------------------------------------------- |
| `noteOn` and `noteOff`  | A note with tick, duration in ticks, MIDI note number, and velocity. |
| `tempo`                 | A tempo change with tick and BPM. BPM is clamped to 1–999.           |
| `timeSignature`         | A time-signature change with tick, numerator, and denominator.       |
| `marker` and `cuePoint` | A song marker with tick and name.                                    |
| `pitchBend`             | A pitch-bend event with tick and a normalized value from -1 to 1.    |
| `controlChange:1`       | A modulation event with tick and a value from 0 to 1.                |
| `controlChange:7`       | A track-volume event with tick and a value from 0 to 1.              |

Notes are sorted by tick and MIDI note number. Pitch-bend, modulation, and track-volume events are
sorted by tick. Marker and header changes are sorted by tick.

## Silently ignored events

The code is the source of truth for this list: it is exported as
`SILENTLY_IGNORED_EVENT_TYPES` from `packages/midi-parser/src/supported-events.ts`. The entries
below match that exported constant exactly, including order:

| Event type          | Why it is ignored                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `trackName`         | It is source metadata, not a synthesized runtime event. The parsed track name is retained separately for identification and role suggestions. |
| `endOfTrack`        | It only terminates a MIDI track and has no synthesized audio meaning.                                                                         |
| `text`              | It is descriptive MIDI metadata, not an instruction to the synthesized runtime.                                                               |
| `copyright`         | It is attribution metadata, not an instruction to the synthesized runtime.                                                                    |
| `instrumentName`    | It is descriptive MIDI metadata; the Builder assigns synthesized instruments separately.                                                      |
| `lyrics`            | It is text metadata and does not produce synthesized audio.                                                                                   |
| `sequencerSpecific` | It is application-specific metadata with no defined meaning to this synthesized runtime.                                                      |
| `controlChange:121` | Reset-all-controllers is a device state command, not a supported synthesized parameter.                                                       |
| `controlChange:123` | All-notes-off is a device state command; note timing comes from the compiled note events.                                                     |

Other events that are not consumed produce warnings. In particular, unsupported program changes,
controllers, aftertouch, System Exclusive messages, and key signatures are not silently ignored.

## Import warnings

Each `MidiImportWarning` contains these fields:

- `sourceFilename`: the imported filename.
- `trackName`: the source track name, or `Header` for header-level warnings.
- `trackIndex`: the source track index, or `-1` for header-level warnings.
- `eventType`: the event type, such as `controlChange:74` or `sysex`.
- `tick`: the first occurrence's tick for an aggregated event warning.
- `message`: what was ignored or normalized.
- `suggestedAction`: an action string, or `null` when no action is provided.

Unsupported events are aggregated as one warning per track per event type, rather than one warning
per occurrence. The warning message includes the total occurrence count, and `tick` is the first
occurrence. The collector exposes the first 200 warning entries. If more entries exist, it appends a
final `warningsTruncated` warning with the message `Warnings were truncated after 200 entries.`

## Role suggestions

Suggestions are advisory. The parser never assigns a role; it returns a suggestion with a role,
reason, and confidence for each compiled track.

Track names are compared case-insensitively after spaces, hyphens, and underscores are removed.
The name tables are evaluated in this order:

- `percussion` (high confidence): `kick`, `snare`, `hat`, `hihat`, `tom`, `clap`, `perc`, `drum`,
  `noise`, `click`, `crash`, `ride`, `rim`, `shaker`, `cym`.
- `metadata` (high confidence): `meta`, `marker`, `tempo`, `conductor`, `map`, `cue`.
- `ignored` (high confidence): `mute`, `unused`, `ignore`, `off`.
- `pitched` (high confidence): `pulse`, `tri`, `saw`, `square`, `lead`, `bass`, `pad`, `drone`,
  `arp`, `harmony`, `signal`, `melody`, `chord`, `string`, `organ`, `piano`, `synth`.
- `pitched` (low confidence) when no name pattern matches. The reason is
  `No name pattern matched; defaulting to pitched.`

The implementation checks MIDI channel 9 first and returns a high-confidence `percussion`
suggestion with the reason `Track uses MIDI channel 9, the General MIDI percussion channel.` This
overrides name-based suggestions. A track with no notes and at least one marker returns a
high-confidence `metadata` suggestion with the reason `Track contains marker events and no note
events.`, unless the channel 9 override applies.

## Missing header defaults

If there is no tempo event at tick 0, the parser adds 120 BPM at tick 0 and emits a `tempo` warning.
Tempo values outside the supported range are clamped to 1–999 BPM, and each clamping occurrence
emits a `tempoClamped` warning.

If there is no time-signature event at tick 0, the parser adds 4/4 at tick 0 and emits a
`timeSignature` warning.

## MIDI editing

MIDI editing is out of scope. The Builder never writes `.mid` files. The user's DAW remains
authoritative for the composition.
