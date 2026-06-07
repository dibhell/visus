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
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive
import kotlinx.coroutines.delay
import kotlinx.coroutines.Job
import android.util.Log

data class PlaylistItem(val id: String, val title: String, val artist: String, val uri: Uri, val isStream: Boolean)

class MusicPlayer(context: Context, private val scope: CoroutineScope) {
    private val player = ExoPlayer.Builder(context).build().apply {
        repeatMode = Player.REPEAT_MODE_ALL
    }

    private val _sessionId = MutableStateFlow(0)
    val sessionId: StateFlow<Int> = _sessionId

    private val _playlist = MutableStateFlow<List<PlaylistItem>>(emptyList())
    val playlist: StateFlow<List<PlaylistItem>> = _playlist

    private val _current = MutableStateFlow<PlaylistItem?>(null)
    val current: StateFlow<PlaylistItem?> = _current

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying
    private val _positionMs = MutableStateFlow(0L)
    val positionMs: StateFlow<Long> = _positionMs
    private val _durationMs = MutableStateFlow(0L)
    val durationMs: StateFlow<Long> = _durationMs
    private var pollJob: Job? = null

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            _isPlaying.value = isPlaying
        }
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            val found = _playlist.value.firstOrNull { it.id == mediaItem?.mediaId }
            _current.value = found
        }
        override fun onAudioSessionIdChanged(audioSessionId: Int) {
            _sessionId.value = audioSessionId
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
                    Log.w("VISUS", "MusicPlayer poll error: ${t.message}")
                    break
                }
                delay(250L)
            }
        }
    }

    fun addToPlaylist(item: PlaylistItem, playNow: Boolean = false) {
        _playlist.value = _playlist.value + item
        player.addMediaItem(
            MediaItem.Builder()
                .setUri(item.uri)
                .setMediaId(item.id)
                .setTag(item.title)
                .build()
        )
        if (playNow || player.mediaItemCount == 1) {
            player.seekTo(player.mediaItemCount - 1, 0)
            player.prepare()
            player.playWhenReady = true
        }
        ensurePolling()
    }

    fun playPause() {
        if (player.isPlaying) player.pause() else {
            if (player.mediaItemCount == 0 && _playlist.value.isNotEmpty()) {
                player.prepare()
            }
            player.play()
        }
        ensurePolling()
    }

    fun stop() {
        player.pause()
        player.seekTo(0)
    }

    fun next() = player.seekToNextMediaItem()
    fun prev() = player.seekToPreviousMediaItem()
    fun seekTo(positionMs: Long) {
        player.seekTo(positionMs.coerceAtLeast(0))
    }
    fun seekBy(deltaMs: Long) {
        seekTo(player.currentPosition + deltaMs)
    }

    fun release() {
        player.removeListener(listener)
        player.release()
        pollJob?.cancel()
    }
}
