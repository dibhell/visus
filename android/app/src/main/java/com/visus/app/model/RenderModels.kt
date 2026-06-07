package com.visus.app.model

data class FxSlotUniform(
    val title: String,
    val presetName: String,
    val blendMode: BlendMode,
    val modulationBand: BandType,
    val intensity: Float,
    val mix: Float,
    val activeLevel: Float,
    val bypassed: Boolean
)

data class RenderParams(
    val aspect: AspectRatio,
    val scale: Float,
    val panX: Float,
    val panY: Float,
    val mirror: Boolean,
    val bpm: Float,
    val phase: Float,
    val bands: List<Float>,
    val main: FxParamSet,
    val slots: List<FxSlotUniform>
)
