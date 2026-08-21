# ThinkBreak Web Audio Builder

## 1. Project summary

ThinkBreak Web Audio Builder is an open-source browser application for converting MIDI compositions into portable, synthesized Web Audio projects.

The application allows a user to:

1. Import a multitrack MIDI file.
2. Assign and edit synthesized instruments for each MIDI track.
3. Preview the complete composition in the browser.
4. Mix pitched and percussion channels.
5. Save and reopen Builder projects.
6. Export framework-neutral TypeScript and project data for use in browser games and applications.

The Builder preview and exported project MUST use the same audio runtime so the exported composition sounds substantially the same as it did inside the Builder.

The first implementation is intended to support the complete music requirements of BotGen Idle while remaining useful as a general open-source browser audio tool.

---

## 2. Product goals

The project MUST:

* Run primarily in the browser.
* Use the native Web Audio API for synthesis and playback.
* Import Standard MIDI Files.
* Support complete multitrack compositions.
* Support pitched instruments.
* Support synthesized percussion.
* Require no recorded samples or SoundFonts.
* Allow instrument parameters to be edited through a visual interface.
* Preview all channels together in real time.
* Save projects locally for immediate recovery.
* Save projects to PostgreSQL for durable server-side persistence.
* Export portable browser-compatible TypeScript.
* Keep the exported runtime independent from frontend frameworks.
* Remain usable during temporary server or network outages.
* Deploy to Railway directly from the connected repository.
* Use understandable and maintainable source code.
* Be suitable for development by humans and AI coding agents.
* Be released as a public open-source repository.

---

## 3. Initial non-goals

The first public version MUST remain focused.

The following features are outside the initial scope:

* MIDI note editing
* Piano-roll editing
* Audio recording
* Imported audio samples
* SoundFont playback
* WAV, MP3, or Ogg rendering
* Audio plugin systems
* Arbitrary modular audio graphs
* AudioWorklet processors
* Real-time collaboration
* Automation-lane editing
* General MIDI instrument emulation
* Cloud file storage outside PostgreSQL
* Framework-specific export generators
* Multiple songs inside one Builder project
* Mobile-first composition workflows
* Full DAW functionality

The user's DAW remains the authoritative environment for composition and MIDI editing.

---

## 4. Recommended technology stack

### 4.1 Primary application stack

The application stack is:

* SvelteKit
* TypeScript with strict mode
* Vite
* SvelteKit Node adapter
* Svelte stores or simple module-based state
* Zod for runtime validation
* pnpm workspaces
* Node.js LTS

### 4.2 Audio stack

The audio system MUST use:

* Native Web Audio API
* `@tonejs/midi` for MIDI parsing
* Standard Web Audio nodes
* A custom scheduler and transport
* A shared runtime package

The application MUST NOT use Tone.js as the playback runtime.

Expected Web Audio nodes include:

* `AudioContext`
* `OscillatorNode`
* `GainNode`
* `BiquadFilterNode`
* `StereoPannerNode`
* `DynamicsCompressorNode`
* `AnalyserNode`
* `AudioBufferSourceNode` for generated noise buffers

### 4.3 Persistence stack

The persistence system MUST use:

* IndexedDB for immediate local project storage
* `idb` or an equivalent typed IndexedDB wrapper
* PostgreSQL for durable server-side storage
* Railway PostgreSQL
* Drizzle ORM
* Drizzle migrations
* JSZip for portable project and code-export archives

Prisma or Kysely may replace Drizzle only if that decision is made before database implementation begins and is documented.

### 4.4 Testing and quality

The project MUST use:

* Vitest
* TypeScript compiler checks
* ESLint
* Prettier
* CI through GitHub Actions
* Database migration checks
* Export integration tests
* Manual browser verification

### 4.5 Deployment

The application MUST deploy to Railway from the connected GitHub repository.

Production infrastructure MUST include:

* One Railway application service
* One Railway PostgreSQL service
* Repository-triggered deployments
* Railway-managed environment variables
* A production health endpoint
* A database migration step before deployment becomes active

---

## 5. Core user workflow

The application MUST support this workflow:

```text
Create or open a project
    |
Import a multitrack MIDI file
    |
Inspect generated channels
    |
Assign pitched or percussion instruments
    |
Edit synthesis settings
    |
Preview and mix the composition
    |
Set loop behavior
    |
Save locally
    |
Synchronize to PostgreSQL
    |
Export framework-neutral TypeScript
```

A user MUST be able to replace the MIDI data assigned to an existing channel without losing that channel's instrument settings.

### 5.1 Compact musician-facing workspace contract

The workspace MUST keep the existing two top-level views: **Instrument** and **Mixer**. Instrument
follows the selected channel and owns the channel header, synthesis controls, instrument presets,
and press-and-hold preview. Mixer is the one global all-channel balancing surface and owns channel
gain, pan, mute, solo, meters and audibility, plus loop controls, sound sets, normalization, and the
master section. There is no focused or per-channel Mixer tab and no duplicated channel-mix surface.

Continuous parameters SHOULD use a compact rotary control with native slider semantics and an
editable numeric value beneath it. Every rotary control MUST remain operable by keyboard and MUST
provide units, validation, and reset-to-default behavior. Closely related values MAY share one knob
through a labelled segmented selector when this reduces panel size without mixing unrelated units:

* Pitched tuning uses one stepped knob selected by `O` (Octave), `S` (Semitone), or `F` (Fine).
* Amplitude envelopes use one smooth knob selected by `A`, `D`, `S`, or `R`.
* Percussion oscillator pitch may bank Start and End.
* Filters, channel gain/pan, layer gains, root note, master gain, and compressor parameters remain
  dedicated controls.

The selected bank member and top-level view are temporary UI state. Changing them MUST NOT change
audio, dirty the project, autosave, synchronize, or appear in portable/code exports. Preset headers
use familiar previous/next arrows plus explicit Browse and Save As actions; icons always have
visible text or unambiguous accessible names and help text. Factory presets cannot be overwritten.
Compact mixer strips use a vertical gain fader, a pan knob, text `MUTE`/`SOLO` toggles, a meter,
and textual audibility. The workspace MUST remain usable at 1024×640 and at 200% zoom.

All workspace controls sit on a modular sizing grid: an 8px base unit, module widths in multiples of
32px, and 32px height bands, with padding baked into each module so runs of controls tile with no
leftover pixels between them. The goal is that instrument modules assemble like hardware panel
blocks rather than needing per-screen pixel nudging. The normative rules are in
`spec/implementation/00-conventions.md` §5.4. The 1024×640 and 200% zoom requirement above is
unchanged; §5.4 states which surfaces tile exactly at that viewport and which scroll.

Implementation is deliberately split at the rendering boundary. Phase 09A's non-rendering
instrument/preset foundation is delivered; phase 10A's headless transport/global-Mixer foundation
is delivered. Rendered Instrument phase 09B and rendered transport/global-Mixer phase 10B are paused
and MUST be designed and approved together before either changes the visible workspace.

---

## 6. Project scope

One Builder project represents one complete composition.

A project MUST contain:

* Project ID
* Project name
* Schema version
* Creation timestamp
* Modification timestamp
* Local synchronization state
* Server revision number
* Original MIDI filename
* Original MIDI file
* Parsed MIDI song data
* Tempo map
* Time signatures
* Loop settings
* Channel definitions
* Instrument definitions
* Master mixer settings
* Export settings

Example:

```ts
interface BuilderProject {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;

  sync: {
    serverRevision: number | null;
    hasUnsyncedChanges: boolean;
    lastSyncedAt: number | null;
  };

  sourceMidi: {
    filename: string;
    fileData: ArrayBuffer;
  };

  song: CompiledSong;
  channels: AudioChannelDefinition[];

  transport: {
    loopEnabled: boolean;
    loopStartTick: number;
    loopEndTick: number;
    tempoMultiplier: number;
  };

  master: {
    gain: number;
    compressor: CompressorSettings;
  };

  exportSettings: {
    packageName: string;
    includeTests: boolean;
    includeExample: boolean;
  };
}
```

Every persisted project MUST include a schema version.

Project migrations MUST be implemented whenever the stored project schema changes.

---

## 7. MIDI import requirements

The application MUST accept `.mid` and `.midi` files through:

* Drag and drop
* File picker

The importer MUST read:

* Track names
* MIDI channel numbers
* Note-on events
* Note-off events
* Note velocities
* Note durations
* Ticks per quarter note
* Tempo changes
* Time signatures
* Pitch-bend events
* Modulation-wheel events
* Track-volume events
* Marker events

The importer MUST convert the MIDI file into a normalized internal song format.

The importer MUST report unsupported events with:

* Source filename
* Track name
* Event type
* Tick position
* Suggested action where practical

Unsupported events MUST NOT be silently discarded unless that behavior is explicitly documented and tested.

---

## 8. Normalized song format

The normalized song format MUST preserve musical timing in ticks.

```ts
interface CompiledSong {
  schemaVersion: number;
  id: string;
  sourceFilename: string;
  ticksPerQuarterNote: number;
  durationTicks: number;
  tempoChanges: TempoChange[];
  timeSignatures: TimeSignatureChange[];
  markers: SongMarker[];
  tracks: CompiledTrack[];
}

interface TempoChange {
  tick: number;
  bpm: number;
}

interface TimeSignatureChange {
  tick: number;
  numerator: number;
  denominator: number;
}

interface SongMarker {
  tick: number;
  name: string;
}

interface CompiledTrack {
  id: string;
  sourceTrackName: string;
  midiChannel: number;
  notes: CompiledNote[];
  pitchBends: PitchBendEvent[];
  modulationEvents: ModulationEvent[];
}

interface CompiledNote {
  tick: number;
  durationTicks: number;
  midiNote: number;
  velocity: number;
}
```

The runtime MUST convert ticks into audio-clock time through the tempo map.

---

## 9. Track creation and assignment

Each imported MIDI track MUST create one Builder channel.

Each channel MUST allow the user to assign one of these roles:

* Pitched instrument
* Percussion instrument
* Ignored track
* Metadata track

The application SHOULD recognize common track names and suggest assignments.

Example mappings:

```text
PULSE_1       -> Pitched
PULSE_2       -> Pitched
TRI_BASS      -> Pitched
SIGNAL_LEAD   -> Pitched
DRONE         -> Pitched
NOISE_KICK    -> Percussion
NOISE_SNARE   -> Percussion
NOISE_HAT     -> Percussion
BOTGEN_META   -> Metadata
```

All suggestions MUST remain editable.

The user MUST be able to:

* Rename a Builder channel
* Change the assigned channel type
* Change the assigned instrument preset
* Replace the source MIDI data
* Disable a channel
* Reset the channel to its preset defaults

---

## 10. Pitched instrument requirements

Each pitched channel MUST provide the following controls.

### 10.1 Oscillator

* Waveform

  * Sine
  * Triangle
  * Square
  * Sawtooth
* Octave offset
* Semitone offset
* Fine detune

### 10.2 Amplitude envelope

* Attack
* Decay
* Sustain
* Release

### 10.3 Filter

* Enabled
* Filter type

  * Low-pass
  * High-pass
  * Band-pass
* Cutoff frequency
* Resonance

### 10.4 Voice behavior

* Monophonic or polyphonic
* Maximum polyphony
* Voice-stealing mode

### 10.5 Mixing

* Channel volume
* Pan
* Mute
* Solo

Every continuous parameter MUST provide:

* A slider
* A synchronized numeric input
* Defined minimum and maximum values
* Defined units
* Input validation
* Reset-to-default behavior

---

## 11. Required pitched presets

The initial pitched preset library MUST include:

* Square lead
* Square harmony
* Square arpeggio
* Triangle bass
* Saw signal lead
* Filtered drone
* Soft sine lead

Selecting a preset MUST populate the channel controls.

Preset values MUST remain editable after selection.

Users SHOULD be able to save custom presets locally and to PostgreSQL.

---

## 12. Percussion instrument requirements

Every percussion instrument MUST combine two synthesis layers:

```text
Oscillator layer
        |
        +---- Percussion channel mixer ---- Channel output
        |
Noise layer
```

Both layers MUST be independently configurable and independently mixable.

### 12.1 Oscillator layer

The oscillator layer MUST support:

* Enabled state
* Waveform

  * Sine
  * Triangle
  * Square
  * Sawtooth
* Starting frequency
* Ending frequency
* Pitch-envelope duration
* Attack
* Decay
* Sustain
* Release
* Layer volume

### 12.2 Noise layer

The noise layer MUST support:

* Enabled state
* Generated white noise
* Filter type

  * Low-pass
  * High-pass
  * Band-pass
* Filter cutoff
* Filter resonance
* Attack
* Decay
* Sustain
* Release
* Layer volume

### 12.3 Combined percussion channel

The complete percussion channel MUST support:

* Channel volume
* Pan
* Mute
* Solo
* Choke-group assignment
* Manual preview trigger
* Oscillator-layer volume
* Noise-layer volume

Example:

```ts
interface PercussionInstrumentDefinition {
  id: string;
  name: string;

  oscillatorLayer: {
    enabled: boolean;
    waveform: OscillatorType;
    startFrequencyHz: number;
    endFrequencyHz: number;
    pitchDecaySeconds: number;
    attackSeconds: number;
    decaySeconds: number;
    sustainLevel: number;
    releaseSeconds: number;
    gain: number;
  };

  noiseLayer: {
    enabled: boolean;
    filterType: BiquadFilterType;
    filterFrequencyHz: number;
    filterQ: number;
    attackSeconds: number;
    decaySeconds: number;
    sustainLevel: number;
    releaseSeconds: number;
    gain: number;
  };

  channelGain: number;
  pan: number;
  chokeGroup?: string;
}
```

---

## 13. Required percussion presets

The initial percussion library MUST include:

* Kick
* Snare
* Closed hi-hat
* Open hi-hat
* Tom
* Click
* Warning hit

Every percussion preset MUST use both synthesis layers by default.

The user MUST be able to disable either layer.

Suggested preset behavior:

| Preset        | Oscillator layer            | Noise layer            |
| ------------- | --------------------------- | ---------------------- |
| Kick          | Sine pitch drop             | Short filtered click   |
| Snare         | Triangle or sine body       | Band-pass noise        |
| Closed hi-hat | High oscillator burst       | Short high-pass noise  |
| Open hi-hat   | High oscillator burst       | Longer high-pass noise |
| Tom           | Sine or triangle pitch drop | Quiet filtered attack  |
| Click         | High sine burst             | Very short noise burst |
| Warning hit   | Sawtooth pitch drop         | Resonant noise burst   |

---

## 14. Transport requirements

The application MUST provide:

* Play
* Pause
* Stop
* Return to beginning
* Current playback position
* Song duration
* Loop enabled
* Loop start
* Loop end
* Master tempo display
* Tempo multiplier
* Basic seeking

The transport MUST use a Web Audio look-ahead scheduler.

JavaScript timers MUST identify scheduling work, but note playback MUST be scheduled against `AudioContext.currentTime`.

The scheduler MUST support:

* Tempo changes
* Time-signature changes
* Notes crossing scheduler windows
* Notes crossing loop boundaries
* Pause and resume
* Seeking
* Stopping scheduled voices
* Loop restart without duplicated notes
* Parameter updates during playback
* Project replacement without scheduler leaks

Recommended defaults:

```ts
const DEFAULT_SCHEDULER_SETTINGS = {
  lookaheadMs: 100,
  intervalMs: 25
} as const;
```

---

## 15. Mixer requirements

Each channel MUST provide:

* Name
* Type
* Volume
* Pan
* Mute
* Solo
* Activity indicator
* Basic level meter

The master section MUST provide:

* Master volume
* Compressor enabled
* Compressor threshold
* Compressor knee
* Compressor ratio
* Compressor attack
* Compressor release
* Master level meter

The application MUST prevent expected preset and polyphony combinations from clipping during normal use.

The compressor MUST provide protection and light control. It MUST NOT compensate for consistently excessive channel gains.

---

## 16. Voice management

The runtime MUST enforce configurable voice limits.

Recommended defaults:

```ts
const DEFAULT_AUDIO_LIMITS = {
  maxTracks: 16,
  maxTotalVoices: 32,
  maxVoicesPerChannel: 8,
  maxDroneVoices: 2
} as const;
```

Voice management MUST support:

* Inactive voice reuse
* Per-channel limits
* Global limits
* Predictable voice stealing
* Cleanup after release
* Cleanup after stopping playback
* Cleanup after seeking
* Cleanup after project replacement

Recommended voice-stealing order:

1. Reuse an inactive voice.
2. Release the oldest voice from the same channel.
3. Release the oldest low-priority voice globally.

Voice allocation and stealing MUST be deterministic based on scheduled event order.

---

## 17. Browser audio lifecycle

The application MUST:

* Create or resume audio only after valid user interaction.
* Maintain only one active `AudioContext`.
* Handle suspended `AudioContext` states.
* Suspend or reduce work while the page is hidden.
* Prevent duplicate schedulers.
* Stop and disconnect voices when a project closes.
* Recover cleanly after returning from the background.
* Report browser audio failures without crashing the application.
* Dispose all Web Audio nodes when the audio engine is destroyed.

Audio failure MUST NOT prevent project data from loading, saving, or exporting.

---

## 18. Local-first persistence architecture

ThinkBreak Web Audio Builder MUST use local-first persistence.

### 18.1 IndexedDB

IndexedDB MUST provide:

* Immediate local autosaves
* Offline project access
* Recovery from interrupted sessions
* Temporary project state
* Original MIDI file caching
* Unsynchronized-change tracking
* Recent-project access
* Local custom instrument presets

The application MUST remain usable when:

* The Railway application service is unavailable
* PostgreSQL is unavailable
* The user is offline
* Synchronization fails

### 18.2 PostgreSQL

Railway PostgreSQL MUST provide durable server-side persistence.

PostgreSQL MUST store:

* Project metadata
* Serialized project documents
* Project schema versions
* Project ownership or access identifiers
* Custom instrument presets
* Project creation timestamps
* Project modification timestamps
* Synchronization revision numbers
* Future sharing metadata
* Future publishing metadata

The initial implementation MAY store source MIDI files in PostgreSQL using `bytea`.

The persistence layer MUST isolate MIDI file storage behind a repository or service boundary so larger binary files can be moved to object storage later without rewriting the application.

### 18.3 Synchronization rules

The synchronization system MUST:

* Save locally before attempting server synchronization.
* Mark projects with unsynchronized local changes.
* Use monotonically increasing server revision numbers.
* Detect conflicting edits.
* Avoid silently overwriting a newer server revision.
* Preserve local data when synchronization fails.
* Retry synchronization without blocking audio editing.
* Validate projects before local persistence.
* Validate projects before server persistence.
* Display synchronization state to the user.

A basic conflict may be represented as:

```ts
interface ProjectSyncConflict {
  projectId: string;
  localRevision: number | null;
  serverRevision: number;
  localUpdatedAt: number;
  serverUpdatedAt: number;
}
```

The first release MAY resolve conflicts through a simple user choice:

* Keep local version
* Load server version
* Duplicate local version

Automatic merging is outside the initial scope.

---

## 19. Project-management requirements

The application MUST support:

* Create project
* Rename project
* Duplicate project
* Autosave project
* Open recent project
* Delete project
* Synchronize project
* Export portable project
* Import portable project
* View local synchronization state

Autosave SHOULD occur:

* After MIDI import
* After channel assignment
* After instrument changes
* After mixer changes
* After loop changes
* After project metadata changes
* After a short debounce following parameter edits

The application MUST NOT write to IndexedDB or PostgreSQL on every slider input event.

Continuous controls MUST update the audio preview immediately while persistence remains debounced.

---

## 20. Portable Builder project format

Portable projects SHOULD use this extension:

```text
project-name.tbwab
```

The file SHOULD be a ZIP archive containing:

```text
project.json
source.mid
```

`project.json` MUST contain:

* Schema version
* Parsed song data
* Channel settings
* Instrument settings
* Mixer settings
* Loop settings
* Source MIDI metadata
* Export settings

The original MIDI file MUST be preserved in the project archive.

Portable imports MUST:

1. Read the archive.
2. Validate required files.
3. Validate the project schema.
4. Validate the source MIDI file.
5. Run project migrations if required.
6. Preserve the active project if validation fails.
7. Replace or duplicate the active project only after validation succeeds.

---

## 21. Server architecture

When using SvelteKit, the project MUST use:

* SvelteKit Node adapter
* SvelteKit server routes or server actions
* Server-only database modules
* Shared Zod schemas
* Server-side environment variables
* Drizzle database access

Database credentials MUST never enter browser bundles.

Recommended server responsibilities:

* Create projects
* Load projects
* Update projects
* Delete projects
* List projects
* Synchronize project revisions
* Save custom presets
* Load custom presets
* Validate imported project data
* Provide a health endpoint

Recommended server-only structure:

```text
apps/builder/src/lib/server/
  database/
    client.ts
    schema.ts
    migrations/
  repositories/
    project-repository.ts
    preset-repository.ts
  services/
    project-service.ts
    sync-service.ts
    preset-service.ts
  validation/
    request-schemas.ts
```

All incoming request data MUST be validated through shared Zod schemas.

---

## 22. Initial API requirements

The initial server API SHOULD provide:

```text
GET    /api/health
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PUT    /api/projects/:projectId
DELETE /api/projects/:projectId

GET    /api/presets
POST   /api/presets
PUT    /api/presets/:presetId
DELETE /api/presets/:presetId
```

Project update requests MUST include the expected server revision.

Example:

```ts
interface UpdateProjectRequest {
  expectedRevision: number;
  project: BuilderProject;
}
```

A revision mismatch MUST produce a conflict response rather than overwriting the server project.

---

## 23. Initial database model

The initial PostgreSQL schema SHOULD include:

```text
projects
project_files
instrument_presets
```

Suggested `projects` columns:

```text
id
name
access_token_hash
schema_version
revision
project_document
created_at
updated_at
```

Suggested `project_files` columns:

```text
id
project_id
filename
mime_type
file_data
created_at
updated_at
```

Suggested `instrument_presets` columns:

```text
id
name
preset_type
preset_document
access_token_hash
created_at
updated_at
```

`project_document` and `preset_document` SHOULD use `jsonb`.

Source MIDI data MAY use `bytea`.

Database tables MUST include indexes for:

* Project ID
* Project modification date
* Project access identifier
* Preset access identifier

---

## 24. Initial project access model

The first public alpha MAY operate without full user accounts.

Server-saved projects MUST still use an unguessable project access token.

The raw token MUST only be shown to the client when the project is created.

The database SHOULD store a hash of the access token rather than the raw value.

The client MAY store the access token in IndexedDB as part of the local project record.

Future authentication MUST be able to replace or supplement token-based access without changing the core audio project schema.

---

## 25. Railway deployment requirements

The application MUST deploy to Railway directly from the connected repository.

Railway MUST be treated as the production hosting platform.

The Railway project MUST contain:

* Builder application service
* PostgreSQL service

The application service MUST use:

* Repository-root deployment
* A production build command
* A production start command
* Railway-managed environment variables
* A health-check endpoint
* A database migration command

Expected environment variables include:

```text
DATABASE_URL
NODE_ENV
PUBLIC_APP_NAME
PROJECT_TOKEN_SECRET
```

Secrets MUST NOT be committed to the repository.

### 25.1 Deployment behavior

The deployment process MUST:

1. Install workspace dependencies.
2. Run TypeScript checks.
3. Run unit tests.
4. Build required workspace packages.
5. Run database migrations.
6. Build the SvelteKit application.
7. Start the Node server.
8. Pass the health check.

The repository SHOULD include:

```text
railway.toml
```

or:

```text
railway.json
```

Example root scripts:

```json
{
  "scripts": {
    "build": "pnpm --filter @thinkbreak/builder build",
    "start": "pnpm --filter @thinkbreak/builder start",
    "check": "pnpm -r check",
    "test": "pnpm -r test",
    "db:generate": "pnpm --filter @thinkbreak/builder db:generate",
    "db:migrate": "pnpm --filter @thinkbreak/builder db:migrate"
  }
}
```

Application-service storage MUST be treated as ephemeral.

Persistent application data MUST be stored in PostgreSQL or exported by the user.

---

## 26. Offline and PWA requirements

The Builder SHOULD be installable as a PWA.

The PWA MUST cache:

* Application shell
* Required JavaScript
* Required CSS
* Static icons
* Local audio runtime code
* Previously opened project data through IndexedDB

The service worker MUST NOT cache private API responses indiscriminately.

The application MUST remain capable of:

* Opening locally saved projects
* Editing synthesis settings
* Playing compositions
* Exporting code
* Exporting portable projects

while offline.

Server synchronization MUST resume after connectivity returns.

---

## 27. Code export requirements

The Builder MUST export framework-neutral TypeScript and project data.

The generated runtime MUST depend only on:

* Standard ES modules
* TypeScript or compiled JavaScript
* Web Audio API
* Browser timing APIs
* Generated project data

The generated runtime MUST NOT depend on:

* Svelte
* React
* Vue
* Phaser
* A router
* A state-management framework
* DOM components
* Server APIs
* Railway
* PostgreSQL

Recommended export structure:

```text
thinkbreak-audio-export/
  README.md
  package.json
  tsconfig.json

  src/
    index.ts

    engine/
      audio-engine.ts
      audio-context.ts
      scheduler.ts
      transport.ts
      tempo-map.ts
      voice-manager.ts

    synth/
      pitched-voice.ts
      percussion-voice.ts
      noise-buffer.ts
      envelope.ts

    mixer/
      master-bus.ts
      channel-bus.ts

    generated/
      project.generated.ts
      instruments.generated.ts
      song.generated.ts

  examples/
    browser.ts

  tests/
    tempo-map.test.ts
    routing.test.ts
```

The export MUST include:

* Compiled song data
* Pitched instrument definitions
* Percussion instrument definitions
* Mixer settings
* Loop settings
* Runtime source
* Browser integration example
* Usage instructions
* Basic tests

---

## 28. Exported runtime API

The initial runtime SHOULD expose:

```ts
interface AudioEngine {
  initialize(): Promise<void>;
  play(): void;
  pause(): void;
  stop(): void;
  seekToSeconds(seconds: number): void;

  setLoopEnabled(enabled: boolean): void;
  setTempoMultiplier(multiplier: number): void;
  setMasterVolume(value: number): void;

  setChannelVolume(channelId: string, value: number): void;
  setChannelMuted(channelId: string, muted: boolean): void;
  setChannelSoloed(channelId: string, soloed: boolean): void;

  dispose(): void;
}
```

Example browser integration:

```ts
import { createAudioEngine } from './thinkbreak-audio-export';

const engine = createAudioEngine();

const startButton = document.querySelector<HTMLButtonElement>(
  '#start-audio'
);

if (startButton === null) {
  throw new Error('Required start button was not found.');
}

startButton.addEventListener('click', async () => {
  await engine.initialize();
  engine.play();
});
```

Framework-specific lifecycle integration belongs to the consuming project.

---

## 29. Shared preview and export runtime

The Builder preview MUST use the same runtime implementation as the exported project.

The repository MUST NOT maintain separate synthesis implementations for:

* Builder preview
* Exported code

The export process MAY copy or package the shared runtime source, but MUST preserve the same behavior.

This requirement applies to:

* Scheduling
* Tempo conversion
* Oscillator generation
* Envelopes
* Filters
* Percussion synthesis
* Voice management
* Mixing
* Loop behavior

---

## 30. Recommended repository structure

```text
thinkbreak-web-audio-builder/
  apps/
    builder/
      src/
        lib/
          client/
            persistence/
            sync/
          components/
          features/
            channels/
            export/
            midi-import/
            mixer/
            presets/
            projects/
            transport/
          server/
            database/
            repositories/
            services/
            validation/
          state/
          shared/

        routes/
          api/
            health/
            projects/
            presets/
          projects/
          +layout.svelte
          +page.svelte

      drizzle/
      migrations/
      static/
      tests/

  packages/
    audio-runtime/
      src/
        engine/
        mixer/
        scheduler/
        synth/
        transport/
        types/
      tests/

    project-schema/
      src/
        migrations/
        schemas/
        types/
      tests/

    midi-parser/
      src/
        compile-midi.ts
        normalize-midi.ts
        supported-events.ts
      tests/

    export-generator/
      src/
        generate-export.ts
        templates/
        write-archive.ts
      tests/

  examples/
    vanilla-browser/

  docs/
    architecture.md
    contributing.md
    deployment.md
    midi-support.md
    project-format.md
    runtime-api.md
    synchronization.md

  scripts/

  .github/
    workflows/
      ci.yml

  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  eslint.config.js
  prettier.config.js
  railway.toml
  README.md
  PROJECT_OVERVIEW.md
  AGENTS.md
  LICENSE
```

A simpler structure is acceptable during the earliest implementation phase:

```text
apps/
  builder/

packages/
  audio-runtime/
  project-schema/
```

Additional packages SHOULD be extracted only when module boundaries are clear.

---

## 31. State architecture

The application MUST separate:

* Persistent project state
* Temporary UI state
* Runtime playback state
* Synchronization state

Persistent project state includes:

* MIDI data
* Channel assignments
* Instrument settings
* Mixer settings
* Loop settings
* Export settings

Temporary UI state includes:

* Open panels
* Selected channel
* Drag state
* Dialog visibility
* Temporary numeric input
* Validation display state

Runtime playback state includes:

* Current playback position
* Active voices
* Scheduled-event cursor
* `AudioContext` status
* Meter values
* Active mute and solo calculations

Synchronization state includes:

* Local modification status
* Current server revision
* Last successful synchronization
* Current synchronization request
* Conflict state
* Retry state

Web Audio node objects MUST NOT be stored in serializable project state.

Database connection objects MUST remain server-only.

---

## 32. Validation requirements

Zod schemas MUST validate:

* Builder projects
* Compiled songs
* MIDI tracks
* Pitched instruments
* Percussion instruments
* Master mixer settings
* Portable project imports
* Generated project data
* Server request bodies
* Server responses
* Database documents

Validation MUST occur:

* After MIDI normalization
* Before IndexedDB persistence
* After IndexedDB retrieval
* Before PostgreSQL persistence
* After PostgreSQL retrieval
* During portable project import
* Before code export

Invalid data MUST produce readable errors and preserve the original input where practical.

---

## 33. Coding standards

The repository MUST use:

* TypeScript strict mode
* No undocumented `any`
* Explicit units in variable names
* Small modules with one responsibility
* Pure functions for timing and conversion logic
* Centralized constants
* Exhaustive switch handling
* Contextual error messages
* Runtime validation at external boundaries
* Tests for tempo and scheduling formulas
* Comments that explain intent
* No hidden global mutable state
* No duplicated audio formulas across UI components
* No direct database queries from route components
* Repository or service boundaries around database access
* Idempotent database migrations

Examples of explicit units:

```ts
attackSeconds
frequencyHz
schedulerIntervalMs
startTick
tempoMultiplier
updatedAtMs
```

---

## 34. Error-handling requirements

The application MUST distinguish between:

* MIDI import errors
* Audio initialization errors
* Playback errors
* Project validation errors
* IndexedDB errors
* Synchronization errors
* Database errors
* Export errors
* Migration errors

Errors MUST include enough context to diagnose the failure.

Example:

```ts
throw new Error(
  `Unable to normalize MIDI track "${trackName}" at tick ${tick}: unsupported controller ${controllerNumber}.`
);
```

A failure in one subsystem MUST avoid unnecessary failure in others.

Examples:

* Audio failure must not prevent project export.
* Synchronization failure must not prevent local editing.
* Database failure must not erase local data.
* Export failure must not modify the active project.
* Invalid portable imports must not replace the current project.

---

## 35. Testing requirements

### 35.1 Unit tests

The repository MUST test:

* MIDI note conversion
* MIDI normalization
* Tempo-map construction
* Tick-to-second conversion
* Second-to-tick conversion
* Tempo changes
* Loop boundaries
* Pitch-bend conversion
* Instrument validation
* Percussion-layer validation
* Track assignment
* Voice-limit enforcement
* Voice stealing
* Project migrations
* Synchronization revision logic
* Conflict detection
* Export generation
* Database repository behavior

### 35.2 Manual browser verification

Automated browser and end-to-end tests are intentionally excluded from the repository.

Before release, the maintainer MUST manually verify:

* MIDI drag and drop
* MIDI file selection
* Channel creation
* Instrument parameter editing
* Synchronized sliders and numeric inputs
* Preset application
* Percussion-layer controls
* Play, pause, stop, and seek
* Loop playback
* Mute and solo
* Project autosave
* Local project reopening
* Server synchronization
* Conflict display
* Portable project import
* Portable project export
* TypeScript export
* Audio initialization after user interaction
* Cleanup after project changes
* Offline local editing

### 35.3 Export integration tests

The repository MUST:

1. Generate an export archive.
2. Extract it into a temporary test project.
3. Install or link required dependencies.
4. Compile the exported TypeScript.
5. Run included unit tests.
6. Manually verify that the exported runtime can initialize in a browser.

### 35.4 Browser targets

The public alpha SHOULD be manually tested in current versions of:

* Chromium
* Firefox
* Safari

Chrome-first development is acceptable during early phases.

Browser-specific limitations MUST be documented.

---

## 36. Accessibility requirements

The application MUST:

* Support keyboard navigation.
* Provide labels for every control.
* Expose numeric values without requiring sliders.
* Avoid relying only on color.
* Provide visible focus states.
* Respect reduced-motion settings.
* Allow audio to be disabled.
* Avoid automatically starting sound.
* Provide readable validation errors.
* Provide readable synchronization state.
* Provide text equivalents for mute, solo, and channel activity.

Level meters are supplemental and MUST NOT be required to understand channel state.

---

## 37. Performance requirements

The application SHOULD:

* Maintain one `AudioContext`.
* Maintain one active scheduler.
* Reuse generated noise buffers.
* Avoid rebuilding the complete audio graph after every UI update.
* Debounce IndexedDB persistence.
* Debounce PostgreSQL synchronization.
* Limit meter update rates.
* Stop processing inactive channels.
* Disconnect completed voices.
* Avoid unbounded event and error logs.
* Lazy-load nonessential views.
* Avoid serializing unchanged MIDI data repeatedly.
* Avoid sending the full project to PostgreSQL when no persistent fields changed.

The exported runtime MUST operate without the Builder UI or server.

---

## 38. Security requirements

The application MUST:

* Keep database credentials server-side.
* Validate all incoming server data.
* Validate portable project archives.
* Restrict uploaded files to expected MIDI and project formats.
* Enforce practical request and file-size limits.
* Hash project access tokens before database storage.
* Avoid exposing internal database identifiers unnecessarily.
* Avoid evaluating generated code inside the Builder.
* Generate code as files rather than executing it dynamically.
* Sanitize user-provided project and channel names before using them as filenames or identifiers.

The server MUST NOT trust project data because it originated from the Builder client.

---

## 39. Documentation requirements

The repository MUST include:

* Project overview
* Local development instructions
* Architecture overview
* Railway deployment instructions
* PostgreSQL setup and migration instructions
* MIDI feature support
* Project-file format
* Synchronization behavior
* Runtime API
* Export integration example
* Contribution guidelines
* License
* Known browser limitations

The public repository SHOULD use the MIT license.

---

## 40. Implementation phases

### Phase 1: Repository foundation

Deliver:

* pnpm monorepo
* SvelteKit Builder application
* Shared runtime package
* Shared project schema package
* PostgreSQL connection
* Drizzle configuration
* Railway configuration
* CI
* Formatting and linting
* Initial documentation

Acceptance criteria:

* Application loads locally.
* Application deploys to Railway.
* PostgreSQL connection succeeds.
* Shared packages compile.
* Tests run in CI.
* Health endpoint passes.

### Phase 2: MIDI import

Deliver:

* File import
* MIDI parsing
* Normalized song format
* Track list
* Assignment suggestions
* Validation errors

Acceptance criteria:

* A multitrack MIDI file produces correctly named channels.
* Notes, tempo, time signatures, and duration are preserved.
* Unsupported events produce readable warnings or errors.

### Phase 3: Pitched synthesis

Deliver:

* Oscillator voices
* Amplitude envelopes
* Filters
* Vibrato
* Pitch bend
* Pitched presets
* Channel gain
* Pan
* Voice limits

Acceptance criteria:

* A pitched MIDI track plays through the selected instrument.
* Parameter changes affect preview playback.
* Multiple channels remain synchronized.

### Phase 4: Layered percussion

Deliver:

* Oscillator percussion layer
* Noise percussion layer
* Independent layer volumes
* Percussion presets
* Choke groups
* Manual percussion preview

Acceptance criteria:

* Every percussion hit combines oscillator and noise layers.
* Either layer can be disabled.
* Each layer has independent gain.
* Percussion tracks remain synchronized with pitched tracks.

### Phase 5: Transport and mixer

Deliver:

* Look-ahead scheduler
* Tempo map
* Play
* Pause
* Stop
* Seeking
* Looping
* Mute
* Solo
* Master compressor
* Basic meters

Acceptance criteria:

* Complete songs play in sync.
* Looping does not duplicate notes.
* Seeking reconstructs the correct playback state.
* Stopping removes active and scheduled voices.
* Repeated playback does not create duplicate schedulers.

### Phase 6: Local persistence

Deliver:

* IndexedDB saves
* Autosave
* Local project list
* Local custom presets
* Portable `.tbwab` import and export
* Schema migrations

Acceptance criteria:

* A project reopens locally with identical MIDI, instrument, mixer, and loop settings.
* Invalid imports do not overwrite the active project.
* The Builder remains usable offline.

### Phase 7: PostgreSQL synchronization

Deliver:

* Project API
* Preset API
* Revision tracking
* Conflict detection
* Background synchronization
* Access-token model
* Railway migrations

Acceptance criteria:

* A local project can synchronize to PostgreSQL.
* A server project can load on another browser with its access token.
* Revision conflicts do not overwrite newer data.
* Synchronization failure preserves the local project.

### Phase 8: Code export

Deliver:

* Framework-neutral TypeScript export
* Generated song data
* Generated instrument definitions
* Shared runtime source
* Browser example
* README
* Export tests

Acceptance criteria:

* Exported code runs in a plain Vite TypeScript project.
* Exported playback matches the Builder preview.
* Exported code has no dependency on SvelteKit, Railway, or PostgreSQL.

### Phase 9: Public alpha

Deliver:

* Cross-browser testing
* Accessibility review
* Documentation
* Example project
* Public release workflow
* Open-source licensing
* Railway production deployment

Acceptance criteria:

* A new user can import MIDI, design sounds, save locally, synchronize, reopen the project, and export working browser audio without editing the Builder source.

---

## 41. Initial public-version completion criteria

The first useful public version is complete when a user can:

1. Create a project.
2. Import one multitrack MIDI file.
3. View each MIDI track as a channel.
4. Assign pitched and percussion instruments.
5. Edit instrument settings through sliders and numeric inputs.
6. Build percussion instruments from oscillator and noise layers.
7. Control both percussion-layer volumes independently.
8. Preview the full composition.
9. Mute, solo, and mix channels.
10. Set a loop region.
11. Save and reopen the project locally.
12. Synchronize the project to PostgreSQL.
13. Recover from a failed synchronization without losing work.
14. Export and import a portable Builder project.
15. Export framework-neutral TypeScript.
16. Run the exported code in a basic browser project.
17. Hear substantially the same result in the Builder and exported runtime.
18. Use the deployed application through Railway.
19. Continue editing locally during a temporary server outage.
20. Read sufficient documentation to integrate the exported audio into another browser game.

---

## 42. Final architecture decision

ThinkBreak Web Audio Builder will use:

* SvelteKit
* TypeScript strict mode
* SvelteKit Node adapter
* Native Web Audio API
* `@tonejs/midi` for MIDI parsing
* A custom shared audio runtime
* IndexedDB for local-first editing
* Railway PostgreSQL for durable persistence
* Drizzle ORM and migrations
* Zod validation
* JSZip project and code exports
* Railway repository-based deployment
* Framework-neutral TypeScript exports
* Oscillator-based pitched synthesis
* Combined oscillator and filtered-noise percussion
* One composition per Builder project
* No recorded samples
* No SoundFonts
* No required backend dependency in exported projects

The application server supports Builder persistence and synchronization. The generated audio runtime remains independent from the Builder frontend, Railway, PostgreSQL, and any specific browser framework.
