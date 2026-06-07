package com.visus.app.audio

import android.media.audiofx.Visualizer
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min

class VisualizerAnalyzer(private val scope: CoroutineScope) {
    private val _bands = MutableStateFlow(BandSnapshot(0f, 0f, 0f))
    val bands: StateFlow<BandSnapshot> = _bands
    private var visualizer: Visualizer? = null
    private var job: Job? = null

    fun attachToSession(sessionId: Int) {
        if (sessionId == Visualizer.ERROR_BAD_VALUE || sessionId == 0) return
        release()
        try {
            visualizer = Visualizer(sessionId).apply {
                captureSize = Visualizer.getCaptureSizeRange()[1]
                scalingMode = Visualizer.SCALING_MODE_NORMALIZED
                enabled = true
            }
            job = scope.launch(Dispatchers.Default) {
                val buffer = ByteArray(visualizer?.captureSize ?: 0)
                while (isActive) {
                    val v = visualizer ?: break
                    val len = v.getFft(buffer)
                    if (len > 0) {
                        val snapshot = processFft(buffer, v.samplingRate.toFloat())
                        _bands.value = snapshot
                    }
                    kotlinx.coroutines.delay(16L)
                }
            }
        } catch (e: Throwable) {
            Log.e("VisusVisualizer", "Visualizer init failed: ${e.message}")
            release()
        }
    }

    fun release() {
        job?.cancel()
        job = null
        visualizer?.release()
        visualizer = null
    }

    private fun processFft(fft: ByteArray, sampleRate: Float): BandSnapshot {
        // fft comes as interleaved re/im bytes
        val n = fft.size / 2
        var bass = 0.0
        var mid = 0.0
        var high = 0.0
        val binHz = sampleRate / (2f * n)
        for (i in 1 until n) {
            val re = fft[2 * i].toInt()
            val im = fft[2 * i + 1].toInt()
            val mag = hypot(re.toDouble(), im.toDouble())
            val freq = i * binHz
            when {
                freq < 200 -> bass += mag
                freq < 2000 -> mid += mag
                freq < 8000 -> high += mag
            }
        }
        fun norm(v: Double) = ((20 * ln(v + 1e-9) + 80) / 80).toFloat().coerceIn(0f, 1f)
        return BandSnapshot(norm(bass), norm(mid), norm(high))
    }
}
