package com.visus.app.ui

import android.opengl.GLSurfaceView
import android.util.Log
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.ui.window.Dialog
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.consumeAllChanges
import kotlinx.coroutines.launch
import android.os.Handler
import android.os.Looper
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Stop
import com.visus.app.Telemetry
import com.visus.app.VisusRenderer
import com.visus.app.VisusViewModel
import com.visus.app.model.*
import com.visus.app.ui.components.Knob
import com.visus.app.ui.components.VisusChip
import com.visus.app.ui.components.VisusPanel
import com.visus.app.ui.components.VisusSectionHeader
import com.visus.app.ui.theme.*
import androidx.camera.view.PreviewView

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisusApp(viewModel: VisusViewModel) {
    val tag = "VISUS"
    val context = LocalContext.current
    var initialized by remember { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        initialized = true
        Log.d(tag, "Permissions result: $it")
    }
    LaunchedEffect(initialized) {
        if (initialized) {
            viewModel.attachContext(context.applicationContext)
            Log.d(tag, "Context attached after initialize")
        }
    }
    val audioPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            val name = resolveDisplayName(context, it) ?: "Audio File"
            viewModel.addMusicFile(it, name)
        }
    }
    val videoPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { viewModel.setVideoSource(it) }
    }
    var showUrlDialog by remember { mutableStateOf(false) }
    var urlField by remember { mutableStateOf("") }
    var titleField by remember { mutableStateOf("Preview") }
    var showSearchDialog by remember { mutableStateOf(false) }
    var searchField by remember { mutableStateOf("") }
    var showMusicModal by remember { mutableStateOf(false) }
    var showCameraModal by remember { mutableStateOf(false) }

    if (!initialized) {
        InitializeScreen(
            onInit = {
                Log.d(tag, "Initialize button tapped - requesting permissions")
                permissionLauncher.launch(
                    arrayOf(
                        android.Manifest.permission.CAMERA,
                        android.Manifest.permission.RECORD_AUDIO,
                        android.Manifest.permission.READ_EXTERNAL_STORAGE
                    )
                )
            }
        )
        return
    }

    val mixer by viewModel.mixer.collectAsState()
    val output by viewModel.output.collectAsState()
    val spectrum by viewModel.spectrum.collectAsState()
    val fx by viewModel.fxChain.collectAsState()
    val recording by viewModel.recording.collectAsState()
    val render by viewModel.render.collectAsState()
    val cameraFacing by viewModel.cameraFacing.collectAsState()
    val scrollState = rememberScrollState()
    val configuration = LocalConfiguration.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val isTablet = configuration.smallestScreenWidthDp >= 900
    val useBottomSheet = !isTablet
    var panelVisible by remember { mutableStateOf(true) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
    val scope = rememberCoroutineScope()
    val previewView = remember { PreviewView(context).apply { this.scaleType = PreviewView.ScaleType.FILL_CENTER } }
    DisposableEffect(previewView) {
        viewModel.setPreviewView(previewView)
        viewModel.startCamera(lifecycleOwner)
        onDispose { viewModel.stopCamera() }
    }

    val panelContent: @Composable ColumnScope.() -> Unit = {
        HeaderBar()
        PreviewSection(
            output = output,
            recording = recording,
            onRecord = viewModel::toggleRecording
        )
        MixerSection(
            mixer = mixer,
            onFader = viewModel::setFader,
            onMute = viewModel::toggleMute,
            onSolo = viewModel::toggleSolo,
            onBypass = viewModel::toggleBypass,
            onAnalysisSelect = viewModel::setAnalysisSource,
            onPickAudio = { audioPicker.launch("audio/*") },
            onAddPreview = { showUrlDialog = true },
            onMixToggle = { src -> viewModel.toggleMixSelection(src) },
            mixSelection = mixer.mixSelection,
            onPickVideo = { videoPicker.launch("video/*") },
            onShowSearch = { showSearchDialog = true },
            onShowMusicModal = { showMusicModal = true },
            onShowCameraModal = { showCameraModal = true },
            onPlayMusic = viewModel::toggleMusicPlay,
            onStopMusic = viewModel::stopMusic,
            onPlayVideo = viewModel::toggleVideoPlay,
            onStopVideo = viewModel::stopVideoAudio,
            onPrevMusic = viewModel::prevMusic,
            onNextMusic = viewModel::nextMusic,
            onPrevVideo = { viewModel.seekVideoBy(-5_000) },
            onNextVideo = { viewModel.seekVideoBy(5_000) },
            onSeekMusic = viewModel::seekMusic,
            onSeekVideo = viewModel::seekVideo,
            onPlayPauseAll = viewModel::playPauseAll,
            onStopAll = viewModel::stopAll
        )
        OutputSection(
            state = output,
            onAspect = viewModel::selectAspect,
            onScale = viewModel::setScale,
            onPanX = viewModel::setPanX,
            onPanY = viewModel::setPanY,
            onMirror = viewModel::toggleMirror,
            onRecord = viewModel::toggleRecording,
            recording = recording
        )
        SpectrumSection(
            state = spectrum,
            onBpm = viewModel::setBpm,
            onPhase = viewModel::setPhaseOffset,
            onAnalysisSelect = viewModel::setAnalysisSource,
            onAutoToggle = viewModel::toggleAutoBpm
        )
        MainFxSection(mainFx = fx.main, onUpdate = viewModel::updateMainFx)
        FxChainSection(chain = fx, onUpdateLayer = viewModel::updateSlot)
        Spacer(modifier = Modifier.height(24.dp))
    }

    Box(modifier = Modifier.fillMaxSize().background(DeepSpace)) {
        val handler = remember { Handler(Looper.getMainLooper()) }
        var fps by remember { mutableStateOf("--") }
        var canvasRes by remember { mutableStateOf(output.canvasResolution) }

        // GL surface renders camera/video directly; keep empty backdrop
        Box(modifier = Modifier.fillMaxSize().background(Color.Black))

        VisusSurface(
            modifier = Modifier.fillMaxSize(),
            renderParams = render,
            onTelemetry = { telemetry ->
                handler.post {
                    fps = telemetry.fps.takeIf { it > 0 }?.toString() ?: "--"
                    canvasRes = Resolution(telemetry.canvasWidth, telemetry.canvasHeight)
                    viewModel.setResolutions(canvasRes, output.sourceResolution)
                }
            },
            onSurfaceReady = { surfaceTexture ->
                viewModel.attachExternalSurface(surfaceTexture)
            }
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Black.copy(alpha = 0.45f), Color.Transparent),
                        startY = 0f,
                        endY = 600f
                    )
                )
        )
        StatusBarOverlay(
            output = output,
            recording = recording,
            mixer = mixer,
            fpsText = fps,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(12.dp)
        )
        if (useBottomSheet) {
            if (panelVisible) {
                ModalBottomSheet(
                    sheetState = sheetState,
                    onDismissRequest = { panelVisible = false },
                    containerColor = Panel.copy(alpha = 0.92f),
                    dragHandle = {}
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                            .verticalScroll(scrollState),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                        content = panelContent
                    )
                }
            } else {
                Button(
                    onClick = {
                        panelVisible = true
                        scope.launch { sheetState.show() }
                    },
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(18.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Panel),
                    border = BorderStroke(1.dp, PanelStroke)
                ) { Text("Settings", color = TextPrimary) }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxHeight()
                    .widthIn(min = 360.dp)
                    .align(Alignment.CenterEnd)
                    .padding(horizontal = 16.dp, vertical = 24.dp)
                    .verticalScroll(scrollState),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                content = panelContent
            )
        }
    }

    if (showUrlDialog) {
        AlertDialog(
            onDismissRequest = { showUrlDialog = false },
            title = { Text("Dodaj preview (iTunes URL)") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = urlField, onValueChange = { urlField = it }, label = { Text("URL") })
                    OutlinedTextField(value = titleField, onValueChange = { titleField = it }, label = { Text("Tytul") })
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    if (urlField.isNotBlank()) {
                        viewModel.addMusicPreview(urlField.trim(), titleField.ifBlank { "Preview" })
                    }
                    showUrlDialog = false
                }) { Text("Dodaj") }
            },
            dismissButton = {
                TextButton(onClick = { showUrlDialog = false }) { Text("Anuluj") }
            }
        )
    }

    if (showSearchDialog) {
        val itunes by viewModel.itunes.collectAsState()
        AlertDialog(
            onDismissRequest = { showSearchDialog = false; viewModel.clearITunesResults() },
            title = { Text("Szukaj iTunes") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = searchField, onValueChange = { searchField = it }, label = { Text("Fraza") })
                    Button(onClick = { viewModel.searchITunes(searchField) }) { Text("Szukaj") }
                    itunes.forEach { track ->
                        Surface(
                            color = Panel,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, PanelStroke)
                        ) {
                            Row(
                                modifier = Modifier
                                    .padding(8.dp)
                                    .fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text(track.title, color = TextPrimary, style = MaterialTheme.typography.bodyMedium)
                                    Text(track.artist, color = TextMuted, style = MaterialTheme.typography.bodySmall)
                                }
                                Button(onClick = {
                                    viewModel.addMusicPreview(track.previewUrl, track.title, track.artist)
                                    showSearchDialog = false
                                }) { Text("Dodaj") }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showSearchDialog = false; viewModel.clearITunesResults() }) { Text("Zamknij") }
            },
            dismissButton = {}
        )
    }

    if (showMusicModal) {
        FullscreenModal(title = "Music Catalog", onClose = { showMusicModal = false }) {
            Text("Wybierz zrodlo muzyki", style = MaterialTheme.typography.titleMedium, color = TextPrimary)
            Spacer(Modifier.height(12.dp))
            Button(onClick = { showMusicModal = false; audioPicker.launch("audio/*") }) {
                Text("Pick Audio File")
            }
            Spacer(Modifier.height(8.dp))
            Button(onClick = { showMusicModal = false; showSearchDialog = true }) {
                Text("Open iTunes Search")
            }
        }
    }

    if (showCameraModal) {
        FullscreenModal(title = "Camera / Video", onClose = { showCameraModal = false }) {
            Text("Zrodla wideo", style = MaterialTheme.typography.titleMedium, color = TextPrimary)
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                VisusChip(label = "Back", selected = cameraFacing == com.visus.app.model.CameraFacing.BACK, accent = AccentCyan, onClick = {
                    viewModel.selectCamera(com.visus.app.model.CameraFacing.BACK, lifecycleOwner)
                })
                VisusChip(label = "Front", selected = cameraFacing == com.visus.app.model.CameraFacing.FRONT, accent = AccentPurple, onClick = {
                    viewModel.selectCamera(com.visus.app.model.CameraFacing.FRONT, lifecycleOwner)
                })
            }
            Spacer(Modifier.height(12.dp))
            Button(onClick = { viewModel.startCamera(lifecycleOwner) }) { Text("Start Camera") }
            Spacer(Modifier.height(8.dp))
            Button(onClick = { showCameraModal = false; videoPicker.launch("video/*") }) {
                Text("Pick Video File")
            }
            Spacer(Modifier.height(8.dp))
            Text("CameraX podlaczona do SurfaceTexture (GL updateTexImage). Render feed do shaderow w kolejnym etapie.", color = TextMuted)
        }
    }

}

@Composable
private fun VisusSurface(
    modifier: Modifier = Modifier,
    renderParams: com.visus.app.model.RenderParams,
    onTelemetry: (Telemetry) -> Unit,
    onSurfaceReady: (android.graphics.SurfaceTexture) -> Unit
) {
    val context = LocalContext.current
    val renderer = remember { VisusRenderer() }
    LaunchedEffect(renderParams) {
        renderer.updateState(renderParams)
    }
    LaunchedEffect(Unit) {
        renderer.setTelemetryListener(onTelemetry)
        Log.d("VISUS", "Telemetry listener attached")
    }
    LaunchedEffect(Unit) {
        renderer.setOnSurfaceReady { st -> onSurfaceReady(st) }
    }

    AndroidView(
        modifier = modifier,
        factory = {
            GLSurfaceView(context).apply {
                setEGLContextClientVersion(3)
                setRenderer(renderer)
                renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
                alpha = 1f
            }
        }
    )
}

@Composable
private fun InitializeScreen(onInit: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(AccentPurple.copy(alpha = 0.25f), DeepSpace),
                    center = androidx.compose.ui.geometry.Offset.Zero
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("VISUS", style = MaterialTheme.typography.headlineLarge, color = TextPrimary)
            Text("Initialize to enable camera / mic / storage", color = TextMuted)
            Button(
                onClick = onInit,
                colors = ButtonDefaults.buttonColors(containerColor = AccentPurple),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 10.dp)
            ) {
                Text("INITIALIZE", color = Color.Black, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun StatusBarOverlay(
    output: OutputState,
    recording: RecordingState,
    mixer: MixerState,
    fpsText: String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .background(Panel.copy(alpha = 0.85f), RoundedCornerShape(14.dp))
            .border(BorderStroke(1.dp, PanelStroke), RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        StatusChip("FPS", fpsText)
        StatusChip("Canvas", output.canvasResolution.toString())
        StatusChip("Source", output.sourceResolution.toString())
        StatusChip("MIC", if (mixer.mixSelection.useMic) "ON" else "OFF", mixer.mixSelection.useMic)
        StatusChip("REC", if (recording.isRecording) "ON" else "OFF", recording.isRecording)
    }
}

@Composable
private fun StatusChip(label: String, value: String, highlight: Boolean = false) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = TextMuted)
        Text(
            value,
            color = if (highlight) MeterRed else TextPrimary,
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
private fun FullscreenModal(title: String, onClose: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Dialog(onDismissRequest = onClose) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.6f))
        ) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
                    .align(Alignment.Center),
                colors = CardDefaults.cardColors(containerColor = Panel),
                border = BorderStroke(1.dp, PanelStroke)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(title, style = MaterialTheme.typography.titleLarge, color = TextPrimary)
                        Button(onClick = onClose, colors = ButtonDefaults.buttonColors(containerColor = Panel)) {
                            Text("Close", color = TextPrimary)
                        }
                    }
                    content()
                }
            }
        }
    }
}

@Composable
private fun HeaderBar() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text("VISUS Native", style = MaterialTheme.typography.titleMedium, color = TextPrimary)
            Text("Phase 1 UI", style = MaterialTheme.typography.bodySmall, color = TextMuted)
        }
    }
}

@Composable
private fun PreviewSection(
    output: OutputState,
    recording: RecordingState,
    onRecord: () -> Unit
) {
    VisusPanel(title = "VIDEO PREVIEW", accent = AccentPink) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(240.dp)
                    .background(Color.Transparent)
            ) {
                Surface(
                    modifier = Modifier
                        .fillMaxSize(),
                    color = Color.Black.copy(alpha = 0.85f),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, PanelStroke)
                ) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("GL Canvas (Camera / Video / FX)", color = TextMuted)
                    }
                }
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onRecord,
                        colors = ButtonDefaults.buttonColors(containerColor = if (recording.isRecording) MeterRed else AccentPink),
                        shape = RoundedCornerShape(40.dp)
                    ) {
                        Text(if (recording.isRecording) "Stop" else "REC VIDEO (MP4/WEBM)", color = Color.Black, fontWeight = FontWeight.Bold)
                    }
                    Surface(
                        color = CardOverlay,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, PanelStroke)
                    ) {
                        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text("Canvas ${output.canvasResolution}", color = TextPrimary, style = MaterialTheme.typography.bodySmall)
                            Text("Source ${output.sourceResolution}", color = TextMuted, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                Button(
                    onClick = { /* fullscreen placeholder */ },
                    colors = ButtonDefaults.buttonColors(containerColor = Panel),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(12.dp)
                ) {
                    Text("FULL SCREEN", color = TextPrimary, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun MixerSection(
    mixer: MixerState,
    onFader: (SourceChannel, Float) -> Unit,
    onMute: (SourceChannel) -> Unit,
    onSolo: (SourceChannel) -> Unit,
    onBypass: (SourceChannel) -> Unit,
    onAnalysisSelect: (AnalysisSource) -> Unit,
    onPickAudio: () -> Unit,
    onAddPreview: () -> Unit,
    onMixToggle: (SourceChannel) -> Unit,
    mixSelection: AudioSelection,
    onPickVideo: () -> Unit,
    onShowSearch: () -> Unit,
    onShowMusicModal: () -> Unit,
    onShowCameraModal: () -> Unit,
    onPlayMusic: () -> Unit,
    onStopMusic: () -> Unit,
    onPlayVideo: () -> Unit,
    onStopVideo: () -> Unit,
    onPrevMusic: () -> Unit,
    onNextMusic: () -> Unit,
    onPrevVideo: () -> Unit,
    onNextVideo: () -> Unit,
    onSeekMusic: (Long) -> Unit,
    onSeekVideo: (Long) -> Unit,
    onPlayPauseAll: () -> Unit,
    onStopAll: () -> Unit
) {
    VisusPanel(title = "AUDIO / VIDEO SOURCE", accent = AccentCyan) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            mixer.channels.forEach { channel ->
                MixerStrip(
                    modifier = Modifier.weight(1f),
                    channel = channel,
                    onFader = { onFader(channel.channel, it) },
                    onMute = { onMute(channel.channel) },
                    onSolo = { onSolo(channel.channel) },
                    onBypass = { onBypass(channel.channel) },
                    onPlay = {
                        when (channel.channel) {
                            SourceChannel.MUSIC -> onPlayMusic()
                            SourceChannel.VIDEO -> onPlayVideo()
                            else -> {}
                        }
                    },
                    onStop = {
                        when (channel.channel) {
                            SourceChannel.MUSIC -> onStopMusic()
                            SourceChannel.VIDEO -> onStopVideo()
                            else -> {}
                        }
                    },
                    onPrev = {
                        when (channel.channel) {
                            SourceChannel.MUSIC -> onPrevMusic()
                            SourceChannel.VIDEO -> onPrevVideo()
                            else -> {}
                        }
                    },
                    onNext = {
                        when (channel.channel) {
                            SourceChannel.MUSIC -> onNextMusic()
                            SourceChannel.VIDEO -> onNextVideo()
                            else -> {}
                        }
                    }
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            VisusChip("Audio File", selected = false, accent = AccentPink, onClick = onPickAudio)
            VisusChip("iTunes URL", selected = false, accent = AccentCyan, onClick = onAddPreview)
            VisusChip("iTunes Search", selected = false, accent = AccentPurple, onClick = onShowSearch)
            VisusChip("Video File", selected = false, accent = AccentCyan, onClick = onPickVideo)
            VisusChip("Camera", selected = false, accent = AccentLime, onClick = onShowCameraModal)
        }
    }
}

@Composable
private fun MixerStrip(
    modifier: Modifier = Modifier,
    channel: ChannelState,
    onFader: (Float) -> Unit,
    onMute: () -> Unit,
    onSolo: () -> Unit,
    onBypass: () -> Unit,
    onPlay: () -> Unit,
    onStop: () -> Unit,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    extra: (@Composable () -> Unit)? = null
) {
    val accent = when (channel.channel) {
        SourceChannel.VIDEO -> AccentCyan
        SourceChannel.MUSIC -> AccentPink
        SourceChannel.MIC -> MeterRed
    }
    Card(
        colors = CardDefaults.cardColors(containerColor = Panel),
        border = BorderStroke(1.dp, PanelStroke),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(channel.name.uppercase(), style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold), color = accent)
                    Surface(
                        color = CardOverlay,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, PanelStroke)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Switch(
                                checked = !channel.bypass,
                                onCheckedChange = { onBypass() },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.Black,
                                    checkedTrackColor = accent,
                                    uncheckedThumbColor = Color.DarkGray,
                                    uncheckedTrackColor = PanelStroke
                                )
                            )
                            Text(if (channel.bypass) "OFF" else "ON", color = TextPrimary, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    VisusChip("Mute", channel.mute, accent = MeterRed, onClick = onMute)
                    VisusChip("Solo", channel.solo, accent = AccentLime, onClick = onSolo)
                }
                Box(
                    modifier = Modifier
                        .width(56.dp)
                        .height(190.dp),
                    contentAlignment = Alignment.Center
                ) {
                    VerticalFader(value = channel.fader, onChange = onFader, accent = accent)
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    VisusChip("Bypass", channel.bypass, accent = AccentPurple, onClick = onBypass)
                    MeterBar(level = channel.meter.peak, accent = accent)
                }
            }
            channel.transport?.let {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onPrev, colors = IconButtonDefaults.iconButtonColors(containerColor = CardOverlay), modifier = Modifier.size(46.dp)) {
                        Icon(Icons.Default.SkipPrevious, contentDescription = "Prev", tint = accent)
                    }
                    IconButton(onClick = onPlay, colors = IconButtonDefaults.iconButtonColors(containerColor = if (it.isPlaying) accent else CardOverlay), modifier = Modifier.size(46.dp)) {
                        Icon(if (it.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, contentDescription = "Play", tint = if (it.isPlaying) Color.Black else accent)
                    }
                    IconButton(onClick = onStop, colors = IconButtonDefaults.iconButtonColors(containerColor = CardOverlay), modifier = Modifier.size(46.dp)) {
                        Icon(Icons.Default.Stop, contentDescription = "Stop", tint = accent)
                    }
                    IconButton(onClick = onNext, colors = IconButtonDefaults.iconButtonColors(containerColor = CardOverlay), modifier = Modifier.size(46.dp)) {
                        Icon(Icons.Default.SkipNext, contentDescription = "Next", tint = accent)
                    }
                    Text("${(it.positionMs/1000)}s / ${(it.durationMs/1000)}s", color = TextMuted, style = MaterialTheme.typography.labelSmall)
                }
            }
            extra?.invoke()
        }
    }
}

@Composable
private fun MeterBar(level: Float, accent: Color) {
    val animated = animateFloatAsState(targetValue = level.coerceIn(0f, 1f), label = "meter")
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(8.dp)
            .background(PanelStroke, RoundedCornerShape(999.dp))
    ) {
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(animated.value)
                .background(accent.copy(alpha = 0.7f), RoundedCornerShape(999.dp))
        )
    }
}

@Composable
private fun OutputSection(
    state: OutputState,
    onAspect: (AspectRatio) -> Unit,
    onScale: (Float) -> Unit,
    onPanX: (Float) -> Unit,
    onPanY: (Float) -> Unit,
    onMirror: () -> Unit,
    onRecord: () -> Unit,
    recording: RecordingState
) {
    VisusPanel(title = "OUTPUT & FRAMING", accent = AccentLime) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            AspectRatio.values().forEach { ratio ->
                VisusChip(
                    label = ratio.name.replace("_", " "),
                    selected = state.aspect == ratio,
                    accent = AccentLime,
                    onClick = { onAspect(ratio) },
                    modifier = Modifier.weight(1f)
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        Card(
            colors = CardDefaults.cardColors(containerColor = CardOverlay),
            border = BorderStroke(1.dp, PanelStroke),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Knob(label = "Scale", value = state.scale, range = 0.1f..3f, onChange = onScale, accent = AccentLime, defaultValue = 1f)
                    Knob(label = "Pan X", value = state.panX, range = -1f..1f, onChange = onPanX, accent = AccentCyan, defaultValue = 0f)
                    Knob(label = "Pan Y", value = state.panY, range = -1f..1f, onChange = onPanY, accent = AccentCyan, defaultValue = 0f)
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Mirror", color = TextPrimary, style = MaterialTheme.typography.labelSmall)
                        Switch(
                            checked = state.mirror,
                            onCheckedChange = { onMirror() },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = Color.Black,
                                checkedTrackColor = AccentPurple,
                                uncheckedThumbColor = Color.DarkGray,
                                uncheckedTrackColor = PanelStroke
                            )
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    InfoPill(label = "Canvas", value = state.canvasResolution.toString())
                    InfoPill(label = "Source", value = state.sourceResolution.toString())
                }
            }
        }
    }
}

@Composable
private fun InfoPill(label: String, value: String) {
    Column(
        modifier = Modifier
            .background(CardOverlay, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Text(label.uppercase(), style = MaterialTheme.typography.labelSmall, color = TextMuted)
        Text(value, style = MaterialTheme.typography.bodySmall, color = TextPrimary, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun VerticalFader(value: Float, onChange: (Float) -> Unit, accent: Color) {
    val clamped = value.coerceIn(0f, 1f)
    Box(
        modifier = Modifier
            .width(56.dp)
            .height(190.dp)
            .background(CardOverlay, RoundedCornerShape(18.dp))
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    val newVal = 1f - (offset.y / size.height).coerceIn(0f, 1f)
                    onChange(newVal)
                }
            }
            .pointerInput(Unit) {
                detectVerticalDragGestures { change, dragAmount ->
                    change.consumeAllChanges()
                    val newVal = (clamped - dragAmount / size.height).coerceIn(0f, 1f)
                    onChange(newVal)
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val trackWidth = size.width * 0.25f
            val trackX = size.width / 2f - trackWidth / 2f
            drawRoundRect(
                color = PanelStroke,
                topLeft = Offset(trackX, size.height * 0.08f),
                size = Size(trackWidth, size.height * 0.84f),
                cornerRadius = CornerRadius(trackWidth, trackWidth)
            )
            val knobY = size.height * (1f - clamped) * 0.84f + size.height * 0.08f
            drawCircle(
                color = accent,
                radius = size.width * 0.35f,
                center = Offset(size.width / 2f, knobY)
            )
        }
    }
}

@Composable
private fun SpectrumSection(
    state: SpectrumState,
    onBpm: (Float) -> Unit,
    onPhase: (Float) -> Unit,
    onAnalysisSelect: (AnalysisSource) -> Unit,
    onAutoToggle: () -> Unit
) {
    VisusPanel(title = "INTERACTIVE SPECTRUM + FREQUENCY", accent = AccentPurple) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .height(160.dp),
            color = CardOverlay,
            shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, PanelStroke)
        ) {
            SpectrumOrbs(state.bands)
        }
        Spacer(Modifier.height(10.dp))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            EqBlock(title = "BASS", color = AccentPink)
            EqBlock(title = "MID", color = AccentCyan)
            EqBlock(title = "HIGH", color = AccentLime)
        }
        Spacer(Modifier.height(10.dp))
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = CardOverlay,
            shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, PanelStroke)
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("BPM", color = TextPrimary, style = MaterialTheme.typography.labelSmall)
                Slider(
                    value = state.bpm,
                    onValueChange = onBpm,
                    valueRange = 60f..200f,
                    colors = androidx.compose.material3.SliderDefaults.colors(activeTrackColor = AccentPurple, thumbColor = AccentPurple)
                )
                Text("${state.bpm.toInt()} bpm", color = TextPrimary, fontWeight = FontWeight.Bold)
                Text("OFFSET", color = TextMuted, style = MaterialTheme.typography.labelSmall)
                Slider(
                    value = state.phaseOffset,
                    onValueChange = onPhase,
                    valueRange = -1f..1f,
                    colors = androidx.compose.material3.SliderDefaults.colors(activeTrackColor = AccentCyan, thumbColor = AccentCyan)
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    AnalysisSource.values().forEach { source ->
                        VisusChip(
                            label = source.name,
                            selected = state.analysisSource == source,
                            accent = AccentPurple,
                            onClick = { onAnalysisSelect(source) }
                        )
                    }
                    VisusChip(label = "AUTO", selected = state.autoBpm, accent = AccentLime, onClick = onAutoToggle)
                }
            }
        }
    }
}

@Composable
private fun SpectrumOrbs(bands: List<BandReading>) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(140.dp)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        val positions = listOf(0.2f, 0.5f, 0.8f)
        bands.forEachIndexed { index, band ->
            val animated = animateFloatAsState(targetValue = band.smooth.coerceIn(0f, 1f), label = band.band.name)
            val color = when (band.band) {
                BandType.BASS -> AccentPink
                BandType.MID -> AccentCyan
                BandType.HIGH -> AccentLime
            }
            val size = 40.dp + (70.dp * animated.value)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 6.dp),
                contentAlignment = Alignment.BottomStart
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(start = (positions.getOrElse(index) { 0.2f } * (LocalConfiguration.current.screenWidthDp.dp.value / 3)).dp)
                ) {
                    Surface(
                        color = color.copy(alpha = 0.16f),
                        shape = RoundedCornerShape(50),
                        modifier = Modifier
                            .size(size)
                            .align(Alignment.BottomStart)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Canvas(modifier = Modifier.fillMaxSize()) {
                                drawCircle(color = color.copy(alpha = 0.2f))
                            }
                            Text(band.band.name, color = TextPrimary, style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EqBlock(title: String, color: Color) {
    Surface(
        modifier = Modifier
            .fillMaxWidth(),
        color = CardOverlay,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, PanelStroke)
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, color = color, style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                Knob(label = "FREQ", value = 0.5f, range = 0f..1f, onChange = {}, accent = color)
                Knob(label = "WIDTH", value = 0.5f, range = 0f..1f, onChange = {}, accent = color)
                Knob(label = "GAIN", value = 0.5f, range = 0f..1f, onChange = {}, accent = color)
            }
        }
    }
}

@Composable
private fun MainFxSection(mainFx: FxParamSet, onUpdate: ((FxParamSet) -> FxParamSet) -> Unit) {
    VisusPanel(title = "Master FX Controls", accent = AccentCyan) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                Knob(label = "Intensity", value = mainFx.intensity, range = 0f..1f, onChange = { onUpdate { fx -> fx.copy(intensity = it) } }, accent = AccentCyan)
                Knob(label = "Scale", value = mainFx.scale, range = 0.5f..2.5f, onChange = { onUpdate { fx -> fx.copy(scale = it) } }, accent = AccentLime)
                Knob(label = "Distort", value = mainFx.distort, range = 0f..1f, onChange = { onUpdate { fx -> fx.copy(distort = it) } }, accent = AccentPink)
                Knob(label = "Speed", value = mainFx.speed, range = 0f..2f, onChange = { onUpdate { fx -> fx.copy(speed = it) } }, accent = AccentPurple)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                Knob(label = "Offset X", value = mainFx.offsetX, range = -1f..1f, onChange = { onUpdate { fx -> fx.copy(offsetX = it) } }, accent = AccentCyan)
                Knob(label = "Offset Y", value = mainFx.offsetY, range = -1f..1f, onChange = { onUpdate { fx -> fx.copy(offsetY = it) } }, accent = AccentCyan)
                Knob(label = "Color Shift", value = mainFx.colorShift, range = 0f..1f, onChange = { onUpdate { fx -> fx.copy(colorShift = it) } }, accent = AccentPink)
                Knob(label = "Exposure", value = mainFx.exposure, range = -1f..1f, onChange = { onUpdate { fx -> fx.copy(exposure = it) } }, accent = AccentLime)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                Knob(label = "Contrast", value = mainFx.contrast, range = -1f..1f, onChange = { onUpdate { fx -> fx.copy(contrast = it) } }, accent = AccentPurple)
                Knob(label = "Blur", value = mainFx.blur, range = 0f..1f, onChange = { onUpdate { fx -> fx.copy(blur = it) } }, accent = AccentCyan)
                Knob(label = "Glitch", value = mainFx.glitch, range = 0f..1f, onChange = { onUpdate { fx -> fx.copy(glitch = it) } }, accent = AccentPink)
                Knob(label = "Mix", value = mainFx.mix, range = 0f..1f, onChange = { onUpdate { fx -> fx.copy(mix = it) } }, accent = AccentLime)
            }
        }
    }
}

@Composable
private fun FxChainSection(chain: FxChainState, onUpdateLayer: (Int, (FxSlotState) -> FxSlotState) -> Unit) {
    VisusPanel(title = "FX CHAIN", accent = AccentPurple) {
        FxSlotCard(slot = chain.header, index = -1, accent = AccentPurple) { /* header presets wired later */ }
        Spacer(Modifier.height(10.dp))
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            chain.layers.forEachIndexed { index, slot ->
                FxSlotCard(slot = slot, index = index, accent = AccentCyan) { change ->
                    onUpdateLayer(index) { change(it) }
                }
            }
        }
    }
}

@Composable
private fun FxSlotCard(slot: FxSlotState, index: Int, accent: Color, onChange: ((FxSlotState) -> FxSlotState) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    var bandMenu by remember { mutableStateOf(false) }
    Card(
        colors = CardDefaults.cardColors(containerColor = CardOverlay),
        border = BorderStroke(1.dp, PanelStroke),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Column {
                    Text(slot.title, color = accent, style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                    Text(slot.presetName, color = TextPrimary, style = MaterialTheme.typography.bodySmall)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    VisusChip(label = "Bypass", selected = slot.isBypassed, accent = AccentPurple, onClick = { onChange { it.copy(isBypassed = !it.isBypassed) } })
                    VisusChip(label = slot.blendMode.name, selected = false, accent = accent, onClick = { expanded = true })
                    VisusChip(label = slot.modulationBand.name, selected = false, accent = AccentLime, onClick = { bandMenu = true })
                }
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    BlendMode.values().forEach { mode ->
                        DropdownMenuItem(text = { Text(mode.name) }, onClick = {
                            expanded = false
                            onChange { it.copy(blendMode = mode) }
                        })
                    }
                }
                DropdownMenu(expanded = bandMenu, onDismissRequest = { bandMenu = false }) {
                    BandType.values().forEach { band ->
                        DropdownMenuItem(text = { Text("Mod: ${band.name}") }, onClick = {
                            bandMenu = false
                            onChange { it.copy(modulationBand = band) }
                        })
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Knob(
                    label = "Intensity",
                    value = slot.params.intensity,
                    range = 0f..1f,
                    onChange = { newVal -> onChange { current -> current.copy(params = current.params.copy(intensity = newVal)) } },
                    accent = accent
                )
                Knob(
                    label = "Mix",
                    value = slot.params.mix,
                    range = 0f..1f,
                    onChange = { newVal -> onChange { current -> current.copy(params = current.params.copy(mix = newVal)) } },
                    accent = AccentPurple
                )
                InfoPill(label = "Active", value = "%.2f".format(slot.activeLevel))
            }
        }
    }
}

@Composable
private fun RecordingSection(recording: RecordingState, onToggle: () -> Unit, onArm: (String?) -> Unit) {
    VisusPanel(title = "Recording", accent = MeterRed) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(if (recording.isRecording) "Recording..." else "Standby", color = if (recording.isRecording) MeterRed else TextPrimary, fontWeight = FontWeight.Bold)
                val time = recording.elapsedMs / 1000
                Text("Elapsed ${time}s", color = TextMuted, style = MaterialTheme.typography.bodySmall)
                recording.savePath?.let { Text(it, color = TextMuted, style = MaterialTheme.typography.bodySmall) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilledTonalButton(
                    onClick = { onArm(null) },
                    colors = ButtonDefaults.filledTonalButtonColors(containerColor = Panel)
                ) { Text(if (recording.isArmed) "Armed" else "Arm") }
                Button(
                    onClick = onToggle,
                    colors = ButtonDefaults.buttonColors(containerColor = if (recording.isRecording) MeterRed else AccentPink)
                ) {
                    Text(if (recording.isRecording) "Recording..." else "Standby", color = if (recording.isRecording) MeterRed else TextPrimary, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun RecordingBadge(recording: RecordingState, onToggle: () -> Unit) {
    val color = if (recording.isRecording) MeterRed else AccentPink
    Button(
        onClick = onToggle,
        modifier = Modifier.defaultMinSize(minHeight = 46.dp),
        colors = ButtonDefaults.buttonColors(containerColor = color),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp)
    ) {
        Text(
            if (recording.isRecording) "Stop Recording" else "Record",
            color = Color.Black,
            fontWeight = FontWeight.Bold
        )
    }
}

private fun resolveDisplayName(context: android.content.Context, uri: android.net.Uri): String? {
    return context.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        val idx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
        if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
    }
}

@Composable
private fun PanelCard(title: String, accent: Color, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        border = BorderStroke(1.dp, PanelStroke),
        shape = RoundedCornerShape(18.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Box(
            modifier = Modifier
                .background(
                    brush = Brush.linearGradient(
                        colors = listOf(Panel.copy(alpha = 0.8f), Panel.copy(alpha = 0.55f))
                    )
                )
                .padding(16.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    title.uppercase(),
                    color = accent,
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Black)
                )
                content()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChipButton(label: String, selected: Boolean, accent: Color, onClick: () -> Unit) {
    val border = if (selected) accent else PanelStroke
    Surface(
        color = Color.Transparent,
        contentColor = if (selected) accent else TextPrimary,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .padding(end = 6.dp)
            .defaultMinSize(minHeight = 46.dp),
        tonalElevation = 0.dp,
        shadowElevation = if (selected) 12.dp else 4.dp,
        border = androidx.compose.foundation.BorderStroke(1.dp, border),
        onClick = onClick
    ) {
        Box(
            modifier = Modifier
                .background(
                    Brush.horizontalGradient(
                        if (selected) {
                            listOf(accent.copy(alpha = 0.3f), accent.copy(alpha = 0.15f))
                        } else {
                            listOf(CardOverlay, CardOverlay)
                        }
                    )
                )
                .padding(horizontal = 14.dp, vertical = 10.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(label, style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
        }
    }
}
