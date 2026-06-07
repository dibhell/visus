package com.visus.app.camera

import android.content.Context
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.visus.app.model.CameraFacing
import android.view.Surface
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.ExecutionException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class CameraController(private val context: Context) {
    private var cameraProvider: ProcessCameraProvider? = null
    private var currentFacing: CameraFacing = CameraFacing.BACK
    private var bound = false
    private var externalSurface: Surface? = null

    suspend fun start(lifecycleOwner: LifecycleOwner, previewView: PreviewView, facing: CameraFacing) {
        currentFacing = facing
        val provider = cameraProvider ?: getProvider().also { cameraProvider = it }
        val selector = when (facing) {
            CameraFacing.BACK -> CameraSelector.DEFAULT_BACK_CAMERA
            CameraFacing.FRONT -> CameraSelector.DEFAULT_FRONT_CAMERA
        }
        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }
        try {
            provider.unbindAll()
            provider.bindToLifecycle(lifecycleOwner, selector, preview)
            bound = true
            Log.d(TAG, "Camera bound with facing=$facing")
        } catch (t: Throwable) {
            bound = false
            Log.e(TAG, "Failed to bind camera", t)
        }
    }

    suspend fun startWithSurface(lifecycleOwner: LifecycleOwner, surface: Surface, facing: CameraFacing) {
        currentFacing = facing
        externalSurface = surface
        val provider = cameraProvider ?: getProvider().also { cameraProvider = it }
        val selector = when (facing) {
            CameraFacing.BACK -> CameraSelector.DEFAULT_BACK_CAMERA
            CameraFacing.FRONT -> CameraSelector.DEFAULT_FRONT_CAMERA
        }
        val preview = Preview.Builder().build().also { preview ->
            preview.setSurfaceProvider { request ->
                request.provideSurface(surface, ContextCompat.getMainExecutor(context)) { result ->
                    Log.d(TAG, "Camera surface result: $result")
                }
            }
        }
        try {
            provider.unbindAll()
            provider.bindToLifecycle(lifecycleOwner, selector, preview)
            bound = true
            Log.d(TAG, "Camera bound to external surface with facing=$facing")
        } catch (t: Throwable) {
            bound = false
            Log.e(TAG, "Failed to bind camera to external surface", t)
        }
    }

    fun setExternalSurface(surface: Surface?) {
        externalSurface = surface
    }

    fun stop() {
        cameraProvider?.unbindAll()
        bound = false
    }

    fun isBound(): Boolean = bound
    fun getFacing(): CameraFacing = currentFacing

    private suspend fun getProvider(): ProcessCameraProvider =
        suspendCancellableCoroutine { cont ->
            val future = ProcessCameraProvider.getInstance(context)
            future.addListener({
                try {
                    cont.resume(future.get())
                } catch (e: ExecutionException) {
                    cont.resumeWithException(e.cause ?: e)
                } catch (e: InterruptedException) {
                    cont.resumeWithException(e)
                }
            }, ContextCompat.getMainExecutor(context))
            cont.invokeOnCancellation { future.cancel(true) }
        }

    private companion object {
        const val TAG = "VISUS.Camera"
    }
}
