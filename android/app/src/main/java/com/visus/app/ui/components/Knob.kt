package com.visus.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.visus.app.ui.theme.CardOverlay
import com.visus.app.ui.theme.PanelStroke
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun Knob(
    label: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    onChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = MaterialTheme.colorScheme.primary,
    defaultValue: Float? = null,
    size: Dp = 88.dp,
    formatValue: (Float) -> String = { "%.2f".format(it) }
) {
    var internal by remember { mutableStateOf(value) }
    internal = value

    val normalized = ((internal - range.start) / (range.endInclusive - range.start)).coerceIn(0f, 1f)
    val startAngle = 140f
    val sweepAngle = 260f * normalized

    val gestureModifier = Modifier.pointerInput(range, defaultValue) {
        detectTapGestures(
            onDoubleTap = { defaultValue?.let(onChange) },
            onPress = { /* allow press visual later */ }
        )
    }.pointerInput(range) {
        detectDragGestures { change, drag ->
            val delta = -drag.y / 300f
            val newValue = (internal + delta * (range.endInclusive - range.start)).coerceIn(range.start, range.endInclusive)
            internal = newValue
            onChange(newValue)
        }
    }

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(size)
                .aspectRatio(1f, matchHeightConstraintsFirst = true)
                .clip(CircleShape)
                .background(CardOverlay)
                .then(gestureModifier),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.matchParentSize()) {
                drawArc(
                    color = PanelStroke,
                    startAngle = startAngle,
                    sweepAngle = 260f,
                    useCenter = false,
                    style = Stroke(width = 12f, cap = StrokeCap.Round)
                )
                drawArc(
                    color = accent,
                    startAngle = startAngle,
                    sweepAngle = sweepAngle,
                    useCenter = false,
                    style = Stroke(width = 12f, cap = StrokeCap.Round)
                )
                val angleRad = Math.toRadians((startAngle + sweepAngle).toDouble())
                val radius = size.toPx() / 2f - 12f
                val cx = (size.toPx() / 2f) + radius * cos(angleRad).toFloat()
                val cy = (size.toPx() / 2f) + radius * sin(angleRad).toFloat()
                drawCircle(color = accent, radius = 8f, center = androidx.compose.ui.geometry.Offset(cx, cy))
            }
        }
        Text(
            text = label.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
        )
        Text(
            text = formatValue(internal),
            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold),
            color = accent
        )
    }
}
