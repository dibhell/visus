package com.visus.app.recorder

import android.content.Context
import android.os.Environment
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class RecorderConfig(val width: Int = 1080, val height: Int = 1920, val fps: Int = 30)

class VisusRecorder(private val context: Context) {
    private var outputFile: File? = null
    private var isRecording = false

    fun start(config: RecorderConfig = RecorderConfig()): String {
        val name = "VISUS_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())}.mp4"
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES) ?: context.filesDir
        return try {
            val targetDir = File(dir, "VISUS").also { if (!it.exists()) it.mkdirs() }
            outputFile = File(targetDir, name)
            isRecording = true
            // Stub: actual MediaCodec/EGL pipeline to be implemented
            outputFile!!.absolutePath
        } catch (t: Throwable) {
            val fallback = File(context.cacheDir, name)
            outputFile = fallback
            isRecording = true
            fallback.absolutePath
        }
    }

    fun stop(): String? {
        isRecording = false
        return outputFile?.absolutePath
    }

    fun isRecording(): Boolean = isRecording
}
