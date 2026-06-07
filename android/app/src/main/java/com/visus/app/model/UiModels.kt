package com.visus.app.model

enum class SourceChannel { VIDEO, MUSIC, MIC }
enum class AnalysisSource { VIDEO, MUSIC, MIC, MIX }

data class ChannelState(
    val channel: SourceChannel,
    val name: String,
    val fader: Float,
    val mute: Boolean,
    val solo: Boolean,
    val bypass: Boolean,
    val hasSource: Boolean,
    val transport: TransportState? = null,
    val meter: MeterState = MeterState()
)

data class TransportState(
    val isPlaying: Boolean,
    val positionMs: Long,
    val durationMs: Long,
    val canSeek: Boolean
)

data class MeterState(
    val peak: Float = 0f,
    val rms: Float = 0f
)

data class MixerState(
    val channels: List<ChannelState>,
    val analysisSource: AnalysisSource = AnalysisSource.MUSIC,
    val mixSelection: AudioSelection = AudioSelection()
)

enum class AspectRatio {
    MATRIX, RATIO_16_9, RATIO_9_16, RATIO_4_5, RATIO_1_1
}

data class Resolution(val width: Int, val height: Int) {
    override fun toString(): String = "${width}x$height"
}

data class OutputState(
    val aspect: AspectRatio = AspectRatio.MATRIX,
    val scale: Float = 1f,
    val panX: Float = 0f,
    val panY: Float = 0f,
    val mirror: Boolean = false,
    val canvasResolution: Resolution = Resolution(1920, 1080),
    val sourceResolution: Resolution = Resolution(1920, 1080)
)

enum class BandType { BASS, MID, HIGH }

data class BandReading(
    val band: BandType,
    val instant: Float,
    val smooth: Float,
    val isPeaking: Boolean
)

data class SpectrumState(
    val bands: List<BandReading> = emptyList(),
    val bpm: Float = 128f,
    val phaseOffset: Float = 0f,
    val autoBpm: Boolean = false,
    val analysisSource: AnalysisSource = AnalysisSource.MUSIC
)

enum class BlendMode { NORMAL, ADD, MULTIPLY, SCREEN, LIGHTEN, DARKEN }

data class FxParamSet(
    val intensity: Float = 0.65f,
    val scale: Float = 1f,
    val distort: Float = 0f,
    val speed: Float = 0.5f,
    val offsetX: Float = 0f,
    val offsetY: Float = 0f,
    val colorShift: Float = 0f,
    val exposure: Float = 0f,
    val contrast: Float = 0f,
    val blur: Float = 0f,
    val glitch: Float = 0f,
    val mix: Float = 1f
)

data class FxSlotState(
    val title: String,
    val presetName: String,
    val blendMode: BlendMode,
    val modulationBand: BandType = BandType.BASS,
    val params: FxParamSet,
    val isBypassed: Boolean = false,
    val activeLevel: Float = 0f
)

data class FxChainState(
    val main: FxParamSet,
    val header: FxSlotState,
    val layers: List<FxSlotState>
)

data class RecordingState(
    val isRecording: Boolean = false,
    val isArmed: Boolean = false,
    val elapsedMs: Long = 0L,
    val savePath: String? = null
)
