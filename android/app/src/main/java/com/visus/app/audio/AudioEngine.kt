package com.visus.app.audio

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.jtransforms.fft.DoubleFFT_1D
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min

data class BandSnapshot(val bass: Float, val mid: Float, val high: Float)

class AudioEngine(
    private val scope: CoroutineScope
) {
    private val fftSize = 2048
    private val sampleRate = 44100
    private val bassRange = 20f to 200f
    private val midRange = 200f to 2000f
    private val highRange = 2000f to 8000f

    private var record: AudioRecord? = null
    private var job: Job? = null
    private val fft = DoubleFFT_1D(fftSize.toLong())

    private val _bands = MutableStateFlow(BandSnapshot(0f, 0f, 0f))
    val bands: StateFlow<BandSnapshot> = _bands

    fun start() {
        if (job != null) return
        val minBuf = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        val bufSize = max(minBuf, fftSize * 2)
        record = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            bufSize
        )
        if (record?.state != AudioRecord.STATE_INITIALIZED) {
            record = null
            return
        }
        record?.startRecording()
        job = scope.launch(Dispatchers.Default) {
            val pcm = ShortArray(fftSize)
            val window = hannWindow(fftSize)
            val fftBuffer = DoubleArray(fftSize * 2)
            while (isActive) {
                val read = record?.read(pcm, 0, fftSize) ?: break
                if (read <= 0) continue
                for (i in 0 until read) {
                    val v = pcm[i] / 32768.0 * window[i]
                    fftBuffer[2 * i] = v
                    fftBuffer[2 * i + 1] = 0.0
                }
                // zero-pad if short read
                for (i in read until fftSize) {
                    fftBuffer[2 * i] = 0.0
                    fftBuffer[2 * i + 1] = 0.0
                }
                fft.complexForward(fftBuffer)
                val bass = bandEnergy(fftBuffer, bassRange, sampleRate, fftSize)
                val mid = bandEnergy(fftBuffer, midRange, sampleRate, fftSize)
                val high = bandEnergy(fftBuffer, highRange, sampleRate, fftSize)
                _bands.value = BandSnapshot(bass, mid, high)
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
        record?.stop()
        record?.release()
        record = null
    }

    private fun hannWindow(n: Int): DoubleArray {
        val w = DoubleArray(n)
        for (i in 0 until n) {
            w[i] = 0.5 * (1.0 - kotlin.math.cos(2.0 * Math.PI * i / (n - 1)))
        }
        return w
    }

    private fun bandEnergy(fftBuffer: DoubleArray, range: Pair<Float, Float>, sampleRate: Int, size: Int): Float {
        val (low, high) = range
        val binHz = sampleRate / size.toFloat()
        val startBin = max(1, (low / binHz).toInt())
        val endBin = min(size / 2 - 1, (high / binHz).toInt())
        var energy = 0.0
        for (bin in startBin..endBin) {
            val re = fftBuffer[2 * bin]
            val im = fftBuffer[2 * bin + 1]
            val mag = hypot(re, im)
            energy += mag
        }
        // simple log compression
        val norm = energy / (endBin - startBin + 1).coerceAtLeast(1)
        val db = 20 * ln(norm + 1e-9)
        val scaled = ((db + 80) / 80).toFloat() // rough normalization to 0-1
        return scaled.coerceIn(0f, 1f)
    }
}
