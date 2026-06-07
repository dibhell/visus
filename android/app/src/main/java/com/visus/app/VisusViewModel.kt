package com.visus.app

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.visus.app.audio.AudioEngine
import com.visus.app.audio.BandSnapshot
import com.visus.app.audio.MusicPlayer
import com.visus.app.audio.PlaylistItem
import com.visus.app.audio.VisualizerAnalyzer
import com.visus.app.audio.VideoAudioPlayer
import com.visus.app.audio.ITunesApi
import com.visus.app.audio.ITunesTrack
import com.visus.app.camera.CameraController
import com.visus.app.model.AnalysisSource
import com.visus.app.model.AspectRatio
import com.visus.app.model.BandReading
import com.visus.app.model.BandType
import com.visus.app.model.CameraFacing
import com.visus.app.model.BlendMode
import com.visus.app.model.ChannelState
import com.visus.app.model.FxChainState
import com.visus.app.model.FxParamSet
import com.visus.app.model.FxSlotState
import com.visus.app.model.MeterState
import com.visus.app.model.MixerState
import com.visus.app.model.OutputState
import com.visus.app.model.RecordingState
import com.visus.app.model.SourceChannel
import com.visus.app.model.SpectrumState
import com.visus.app.model.TransportState
import com.visus.app.model.Resolution
import com.visus.app.model.AudioSelection
import com.visus.app.recorder.RecorderConfig
import com.visus.app.recorder.VisusRecorder
import androidx.lifecycle.LifecycleOwner
import android.graphics.SurfaceTexture
import android.view.Surface
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class VisusViewModel : ViewModel() {

    private val micEngine = AudioEngine(viewModelScope)
    private val visualizer = VisualizerAnalyzer(viewModelScope)
    private var musicPlayer: MusicPlayer? = null
    private var videoAudio: VideoAudioPlayer? = null
    private val micBands = MutableStateFlow(BandSnapshot(0f, 0f, 0f))
    private val musicBands = MutableStateFlow(BandSnapshot(0f, 0f, 0f))
    private val videoBands = MutableStateFlow(BandSnapshot(0f, 0f, 0f))
    private var recorder: VisusRecorder? = null
    private var visualSource: VisualSource = VisualSource.MUSIC
    private var cameraController: CameraController? = null
    private var lastLifecycleOwner: LifecycleOwner? = null
    private var previewView: androidx.camera.view.PreviewView? = null
    private var externalSurface: Surface? = null
    private var externalSurfaceTexture: SurfaceTexture? = null

    private val _itunes = MutableStateFlow<List<ITunesTrack>>(emptyList())
    val itunes: StateFlow<List<ITunesTrack>> = _itunes.asStateFlow()

    private val _mixer = MutableStateFlow(
        MixerState(
            channels = listOf(
                ChannelState(SourceChannel.VIDEO, "Video", fader = 1f, mute = false, solo = false, bypass = false, hasSource = true, transport = TransportState(false, 0, 0, false)),
                ChannelState(SourceChannel.MUSIC, "Music", fader = 0.85f, mute = false, solo = false, bypass = false, hasSource = true, transport = TransportState(true, 0, 0, true)),
                ChannelState(SourceChannel.MIC, "Mic", fader = 0.9f, mute = false, solo = false, bypass = false, hasSource = false)
            ),
            mixSelection = AudioSelection(useMic = true, useMusic = true, useVideo = false)
        )
    )
    val mixer: StateFlow<MixerState> = _mixer.asStateFlow()

    private val _output = MutableStateFlow(OutputState())
    val output: StateFlow<OutputState> = _output.asStateFlow()

    private val _spectrum = MutableStateFlow(
        SpectrumState(
            bands = BandType.values().map { band ->
                BandReading(band, instant = 0f, smooth = 0f, isPeaking = false)
            }
        )
    )
    val spectrum: StateFlow<SpectrumState> = _spectrum.asStateFlow()

    private val _fxChain = MutableStateFlow(buildDefaultFxChain())
    val fxChain: StateFlow<FxChainState> = _fxChain.asStateFlow()

    private val _recording = MutableStateFlow(RecordingState())
    val recording: StateFlow<RecordingState> = _recording.asStateFlow()

    private val _render = MutableStateFlow(buildRenderParams())
    val render: StateFlow<com.visus.app.model.RenderParams> = _render.asStateFlow()
    private val _cameraFacing = MutableStateFlow(CameraFacing.BACK)
    val cameraFacing: StateFlow<CameraFacing> = _cameraFacing.asStateFlow()

    init {
        micEngine.start()
        viewModelScope.launch {
            micEngine.bands.collect { snapshot ->
                micBands.value = snapshot
                refreshAnalysis()
            }
        }
        viewModelScope.launch {
            visualizer.bands.collect { snapshot ->
                when (visualSource) {
                    VisualSource.MUSIC -> musicBands.value = snapshot
                    VisualSource.VIDEO -> videoBands.value = snapshot
                }
                refreshAnalysis()
            }
        }
        viewModelScope.launch {
            while (true) {
                if (_recording.value.isRecording) {
                    _recording.update { it.copy(elapsedMs = it.elapsedMs + 16) }
                }
                publishRender()
                delay(16L)
            }
        }
    }

    fun attachContext(context: Context) {
        if (musicPlayer == null) {
            musicPlayer = MusicPlayer(context, viewModelScope)
        }
        if (videoAudio == null) {
            videoAudio = VideoAudioPlayer(context, viewModelScope)
        }
        if (recorder == null) {
            recorder = VisusRecorder(context)
        }
        if (cameraController == null) {
            cameraController = CameraController(context)
        }

        musicPlayer?.let { player ->
            viewModelScope.launch {
                player.sessionId.collectLatest { sid ->
                    if (sid > 0) {
                        visualSource = VisualSource.MUSIC
                        visualizer.attachToSession(sid)
                    }
                }
            }
            viewModelScope.launch {
                player.isPlaying.collectLatest { playing ->
                    updateChannel(SourceChannel.MUSIC) { ch ->
                        ch.copy(transport = ch.transport?.copy(isPlaying = playing))
                    }
                }
            }
            viewModelScope.launch {
                player.positionMs.collectLatest { pos ->
                    updateChannel(SourceChannel.MUSIC) { ch ->
                        val transport = ch.transport ?: TransportState(false, 0, 0, true)
                        ch.copy(transport = transport.copy(positionMs = pos, canSeek = true))
                    }
                }
            }
            viewModelScope.launch {
                player.durationMs.collectLatest { dur ->
                    updateChannel(SourceChannel.MUSIC) { ch ->
                        val transport = ch.transport ?: TransportState(false, 0, 0, true)
                        ch.copy(transport = transport.copy(durationMs = dur, canSeek = true))
                    }
                }
            }
        }
        videoAudio?.let { va ->
            viewModelScope.launch {
                va.sessionId.collectLatest { sid ->
                    if (sid > 0) {
                        visualSource = VisualSource.VIDEO
                        visualizer.attachToSession(sid)
                    }
                }
            }
            viewModelScope.launch {
                va.videoSize.collectLatest { (w, h) ->
                    if (w > 0 && h > 0) {
                        _output.update { it.copy(sourceResolution = Resolution(w, h)) }
                        publishRender()
                    }
                }
            }
            viewModelScope.launch {
                va.isPlaying.collectLatest { playing ->
                    updateChannel(SourceChannel.VIDEO) { ch ->
                        ch.copy(transport = ch.transport?.copy(isPlaying = playing))
                    }
                }
            }
            viewModelScope.launch {
                va.positionMs.collectLatest { pos ->
                    updateChannel(SourceChannel.VIDEO) { ch ->
                        val transport = ch.transport ?: TransportState(false, 0, 0, true)
                        ch.copy(transport = transport.copy(positionMs = pos, canSeek = true))
                    }
                }
            }
            viewModelScope.launch {
                va.durationMs.collectLatest { dur ->
                    updateChannel(SourceChannel.VIDEO) { ch ->
                        val transport = ch.transport ?: TransportState(false, 0, 0, true)
                        ch.copy(transport = transport.copy(durationMs = dur, canSeek = true))
                    }
                }
            }
        }
    }

    // --- Mixer ---
    fun setFader(channel: SourceChannel, value: Float) {
        _mixer.update { mixer ->
            mixer.copy(channels = mixer.channels.map {
                if (it.channel == channel) it.copy(fader = value.coerceIn(0f, 1f)) else it
            })
        }
    }

    fun toggleMute(channel: SourceChannel) = updateChannel(channel) { it.copy(mute = !it.mute) }
    fun toggleSolo(channel: SourceChannel) = updateChannel(channel) { it.copy(solo = !it.solo) }
    fun toggleBypass(channel: SourceChannel) = updateChannel(channel) { it.copy(bypass = !it.bypass) }

    fun setAnalysisSource(source: AnalysisSource) {
        _mixer.update { it.copy(analysisSource = source) }
        _spectrum.update { it.copy(analysisSource = source) }
        refreshAnalysis()
        publishRender()
    }

    fun toggleMixSelection(channel: SourceChannel) {
        _mixer.update { state ->
            val sel = state.mixSelection
            val updated = when (channel) {
                SourceChannel.MIC -> sel.copy(useMic = !sel.useMic)
                SourceChannel.MUSIC -> sel.copy(useMusic = !sel.useMusic)
                SourceChannel.VIDEO -> sel.copy(useVideo = !sel.useVideo)
            }
            state.copy(mixSelection = updated)
        }
        refreshAnalysis()
    }

    private fun updateChannel(channel: SourceChannel, transform: (ChannelState) -> ChannelState) {
        _mixer.update { mixer ->
            mixer.copy(channels = mixer.channels.map {
                if (it.channel == channel) transform(it) else it
            })
        }
    }

    // --- Music playback ---
    fun addMusicPreview(url: String, title: String, artist: String = "Preview") {
        val player = musicPlayer ?: return
        val item = PlaylistItem(id = url, title = title, artist = artist, uri = Uri.parse(url), isStream = true)
        player.addToPlaylist(item, playNow = true)
    }

    fun addMusicFile(uri: Uri, title: String) {
        val player = musicPlayer ?: return
        val item = PlaylistItem(id = uri.toString(), title = title, artist = "Local", uri = uri, isStream = false)
        player.addToPlaylist(item, playNow = true)
    }

    fun toggleMusicPlay() { musicPlayer?.playPause() }
    fun stopMusic() { musicPlayer?.stop() }
    fun nextMusic() { musicPlayer?.next() }
    fun prevMusic() { musicPlayer?.prev() }
    fun seekMusic(positionMs: Long) { musicPlayer?.seekTo(positionMs) }
    fun seekMusicBy(deltaMs: Long) { musicPlayer?.seekBy(deltaMs) }

    // --- Video audio ---
    fun setVideoSource(uri: Uri) {
        videoAudio?.setVideoSurface(externalSurface)
        // stop camera feed to avoid surface contention
        cameraController?.stop()
        videoAudio?.setSource(uri)
        videoAudio?.playPause()
    }

    fun toggleVideoPlay() { videoAudio?.playPause() }
    fun stopVideoAudio() { videoAudio?.stop() }
    fun seekVideo(positionMs: Long) { videoAudio?.seekTo(positionMs) }
    fun seekVideoBy(deltaMs: Long) { videoAudio?.seekBy(deltaMs) }
    fun getVideoPlayer(): com.google.android.exoplayer2.ExoPlayer? = videoAudio?.player

    // --- Camera ---
    fun setPreviewView(view: androidx.camera.view.PreviewView) {
        previewView = view
    }

    fun attachExternalSurface(surfaceTexture: SurfaceTexture) {
        externalSurfaceTexture = surfaceTexture
        externalSurface = Surface(surfaceTexture)
        externalSurfaceTexture?.setDefaultBufferSize(_output.value.sourceResolution.width, _output.value.sourceResolution.height)
        cameraController?.setExternalSurface(externalSurface)
        videoAudio?.setVideoSurface(externalSurface)
        // Restart camera if it was running to rebind to GL surface
        restartCamera()
    }

    fun selectCamera(facing: CameraFacing, owner: LifecycleOwner? = null) {
        _cameraFacing.value = facing
        owner?.let { lastLifecycleOwner = it }
        restartCamera()
    }

    fun startCamera(owner: LifecycleOwner) {
        lastLifecycleOwner = owner
        restartCamera()
    }

    fun stopCamera() {
        cameraController?.stop()
    }

    private fun restartCamera() {
        val owner = lastLifecycleOwner ?: return
        viewModelScope.launch {
            val ext = externalSurface
            if (ext != null) {
                cameraController?.startWithSurface(owner, ext, _cameraFacing.value)
            } else {
                val view = previewView ?: return@launch
                cameraController?.start(owner, view, _cameraFacing.value)
            }
        }
    }

    // --- Global transport ---
    fun playPauseAll() {
        musicPlayer?.playPause()
        videoAudio?.playPause()
    }

    fun stopAll() {
        musicPlayer?.stop()
        videoAudio?.stop()
    }

    // --- iTunes search ---
    fun searchITunes(term: String) {
        viewModelScope.launch {
            _itunes.value = ITunesApi.search(term)
        }
    }

    fun clearITunesResults() { _itunes.value = emptyList() }

    // --- Output ---
    fun selectAspect(aspect: AspectRatio) = _output.update { it.copy(aspect = aspect) }
    fun setScale(value: Float) { _output.update { it.copy(scale = value.coerceIn(0.1f, 3f)) }; publishRender() }
    fun setPanX(value: Float) { _output.update { it.copy(panX = value.coerceIn(-1f, 1f)) }; publishRender() }
    fun setPanY(value: Float) { _output.update { it.copy(panY = value.coerceIn(-1f, 1f)) }; publishRender() }
    fun toggleMirror() { _output.update { it.copy(mirror = !it.mirror) }; publishRender() }
    fun setResolutions(canvas: Resolution, source: Resolution) { _output.update { it.copy(canvasResolution = canvas, sourceResolution = source) }; publishRender() }

    // --- Spectrum / BPM ---
    fun setBpm(bpm: Float) { _spectrum.update { it.copy(bpm = bpm.coerceIn(60f, 200f)) }; publishRender() }
    fun setPhaseOffset(offset: Float) { _spectrum.update { it.copy(phaseOffset = offset) }; publishRender() }
    fun toggleAutoBpm() { _spectrum.update { it.copy(autoBpm = !it.autoBpm) }; publishRender() }

    // --- FX ---
    fun updateMainFx(transform: (FxParamSet) -> FxParamSet) {
        _fxChain.update { it.copy(main = transform(it.main)) }
        publishRender()
    }

    fun updateSlot(index: Int, transform: (FxSlotState) -> FxSlotState) {
        _fxChain.update { chain ->
            val newLayers = chain.layers.mapIndexed { i, slot ->
                if (i == index) transform(slot) else slot
            }
            chain.copy(layers = newLayers)
        }
        publishRender()
    }

    // --- Recording ---
    fun armRecording(targetPath: String? = null) {
        _recording.update { it.copy(isArmed = true, savePath = targetPath) }
    }

    fun toggleRecording() {
        if (_recording.value.isRecording) {
            val path = try {
                recorder?.stop()
            } catch (t: Throwable) {
                null
            }
            _recording.update { it.copy(isRecording = false, elapsedMs = 0, savePath = path) }
        } else {
            val path = try {
                recorder?.start(RecorderConfig())
            } catch (t: Throwable) {
                null
            }
            _recording.update { it.copy(isRecording = path != null, isArmed = path != null, savePath = path) }
        }
    }

    private fun refreshAnalysis() {
        val source = _mixer.value.analysisSource
        val mixSel = _mixer.value.mixSelection
        val mic = micBands.value
        val music = musicBands.value
        val video = videoBands.value

        fun mix(sel: AudioSelection): BandSnapshot {
            val list = buildList {
                if (sel.useMic) add(mic)
                if (sel.useMusic) add(music)
                if (sel.useVideo) add(video)
            }
            if (list.isEmpty()) return BandSnapshot(0f, 0f, 0f)
            val count = list.size.toFloat()
            return BandSnapshot(
                bass = list.sumOf { it.bass.toDouble() }.toFloat() / count,
                mid = list.sumOf { it.mid.toDouble() }.toFloat() / count,
                high = list.sumOf { it.high.toDouble() }.toFloat() / count
            )
        }

        val selected = when (source) {
            AnalysisSource.MIC -> mic
            AnalysisSource.MUSIC -> music
            AnalysisSource.VIDEO -> video
            AnalysisSource.MIX -> mix(mixSel)
        }

        val readings = listOf(
            buildBandReading(BandType.BASS, selected.bass),
            buildBandReading(BandType.MID, selected.mid),
            buildBandReading(BandType.HIGH, selected.high)
        )
        val bandMap = readings.associateBy { it.band }

        _spectrum.update { it.copy(bands = readings) }
        _mixer.update { state ->
            state.copy(
                channels = state.channels.map { channel ->
                    when (channel.channel) {
                        SourceChannel.MIC -> channel.copy(meter = MeterState(peak = mic.bass.coerceAtLeast(mic.mid).coerceAtLeast(mic.high), rms = mic.mid))
                        SourceChannel.MUSIC -> channel.copy(meter = MeterState(peak = music.bass.coerceAtLeast(music.mid).coerceAtLeast(music.high), rms = music.mid))
                        SourceChannel.VIDEO -> channel.copy(meter = MeterState(peak = video.bass.coerceAtLeast(video.mid).coerceAtLeast(video.high), rms = video.mid))
                        else -> channel
                    }
                }
            )
        }
        _fxChain.update { chain ->
            chain.copy(
                header = chain.header.copy(activeLevel = bandMap[chain.header.modulationBand]?.smooth ?: 0f),
                layers = chain.layers.map { slot ->
                    val src = bandMap[slot.modulationBand]?.smooth ?: 0f
                    slot.copy(activeLevel = src)
                }
            )
        }
    }

    private fun buildBandReading(type: BandType, raw: Float): BandReading {
        val smooth = 0.85f * (spectrum.value.bands.firstOrNull { it.band == type }?.smooth ?: 0f) + 0.15f * raw
        val isPeaking = raw > 0.95f
        return BandReading(type, instant = raw, smooth = smooth, isPeaking = isPeaking)
    }

    companion object {
        private enum class VisualSource { MUSIC, VIDEO }
        private fun buildDefaultFxChain(): FxChainState {
            val main = FxParamSet()
            val header = FxSlotState(
                title = "Header FX",
                presetName = "None",
                blendMode = BlendMode.NORMAL,
                modulationBand = BandType.BASS,
                params = FxParamSet(intensity = 0.4f),
                isBypassed = false
            )
            val layers = (1..5).map {
                FxSlotState(
                    title = "Layer $it",
                    presetName = "None",
                    blendMode = BlendMode.ADD,
                    modulationBand = BandType.values()[it % BandType.values().size],
                    params = FxParamSet(intensity = 0.25f + it * 0.05f),
                    isBypassed = false
                )
            }
            return FxChainState(main = main, header = header, layers = layers)
        }
    }

    private fun publishRender() {
        _render.value = buildRenderParams()
    }

    private fun buildRenderParams(): com.visus.app.model.RenderParams {
        val out = _output.value
        val fx = _fxChain.value
        val bands = _spectrum.value.bands.map { it.smooth }
        return com.visus.app.model.RenderParams(
            aspect = out.aspect,
            scale = out.scale,
            panX = out.panX,
            panY = out.panY,
            mirror = out.mirror,
            bpm = _spectrum.value.bpm,
            phase = _spectrum.value.phaseOffset,
            bands = bands,
            main = fx.main,
            slots = (listOf(fx.header) + fx.layers).map { slot ->
                com.visus.app.model.FxSlotUniform(
                    title = slot.title,
                    presetName = slot.presetName,
                    blendMode = slot.blendMode,
                    modulationBand = slot.modulationBand,
                    intensity = slot.params.intensity,
                    mix = slot.params.mix,
                    activeLevel = slot.activeLevel,
                    bypassed = slot.isBypassed
                )
            }
        )
    }
}
