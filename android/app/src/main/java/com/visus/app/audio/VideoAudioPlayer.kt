package com.visus.app.audio

import android.content.Context
import android.net.Uri
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.Player
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.Job
import android.util.Log

class VideoAudioPlayer(context: Context, private val scope: CoroutineScope) {
    val player = ExoPlayer.Builder(context).build().apply {
        repeatMode = Player.REPEAT_MODE_ALL
        volume = 1f
    }

    private val _sessionId = MutableStateFlow(0)
    val sessionId: StateFlow<Int> = _sessionId
    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying
    private val _positionMs = MutableStateFlow(0L)
    val positionMs: StateFlow<Long> = _positionMs
    private val _durationMs = MutableStateFlow(0L)
    val durationMs: StateFlow<Long> = _durationMs
    private var pollJob: Job? = null
    private val _videoSize = MutableStateFlow(Pair(0, 0))
    val videoSize: StateFlow<Pair<Int, Int>> = _videoSize

    private val listener = object : Player.Listener {
        override fun onAudioSessionIdChanged(audioSessionId: Int) {
            _sessionId.value = audioSessionId
        }
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            _isPlaying.value = isPlaying
        }
        override fun onVideoSizeChanged(videoSize: com.google.android.exoplayer2.video.VideoSize) {
            _videoSize.value = Pair(videoSize.width, videoSize.height)
        }
    }

    init {
        player.addListener(listener)
    }

    private fun ensurePolling() {
        if (pollJob?.isActive == true) return
        pollJob = scope.launch(Dispatchers.Default) {
            while (isActive) {
                try {
                    if (player.mediaItemCount > 0) {
                        _positionMs.value = player.currentPosition.coerceAtLeast(0)
                        _durationMs.value = if (player.duration > 0) player.duration else 0L
                    }
                } catch (t: Throwable) {
                    Log.w("VISUS", "VideoAudioPlayer poll error: ${t.message}")
                    break
                }
                delay(250L)
            }
        }
    }

    fun setSource(uri: Uri) {
        player.setMediaItem(MediaItem.fromUri(uri))
        player.prepare()
        ensurePolling()
    }

    fun setVideoSurface(surface: android.view.Surface?) {
        player.setVideoSurface(surface)
    }

    fun playPause() {
        if (player.isPlaying) player.pause() else player.play()
        ensurePolling()
    }

    fun stop() {
        player.pause()
        player.seekTo(0)
    }

    fun seekTo(positionMs: Long) {
        player.seekTo(positionMs.coerceAtLeast(0))
    }

    fun seekBy(deltaMs: Long) {
        seekTo(player.currentPosition + deltaMs)
    }

    fun getAudioSessionId(): Int = player.audioSessionId

    fun release() {
        player.removeListener(listener)
        player.release()
        pollJob?.cancel()
    }
}
