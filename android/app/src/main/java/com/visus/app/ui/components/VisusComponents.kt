package com.visus.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.visus.app.ui.theme.VisusPalette
import com.visus.app.ui.theme.VisusRadius
import com.visus.app.ui.theme.VisusSpacing
import com.visus.app.ui.theme.VisusTypography

@Composable
fun VisusSectionHeader(title: String, action: (@Composable () -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            title.uppercase(),
            style = VisusTypography.title,
            color = VisusPalette.accent1
        )
        Spacer(modifier = Modifier.weight(1f))
        action?.invoke()
    }
}

@Composable
fun VisusPanel(
    title: String,
    accent: Color,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        border = BorderStroke(1.dp, VisusPalette.panelStroke),
        shape = RoundedCornerShape(VisusRadius.lg),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Box(
            modifier = Modifier
                .background(
                    brush = Brush.linearGradient(
                        listOf(VisusPalette.panel.copy(alpha = 0.82f), VisusPalette.panel.copy(alpha = 0.6f))
                    )
                )
                .padding(VisusSpacing.md)
        ) {
            Column {
                VisusSectionHeader(title)
                Spacer(modifier = Modifier.height(VisusSpacing.sm))
                content()
            }
        }
    }
}

@Composable
fun VisusChip(
    label: String,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .clickable { onClick() },
        shape = RoundedCornerShape(VisusRadius.sm),
        color = Color.Transparent,
        border = BorderStroke(1.dp, if (selected) accent else VisusPalette.panelStroke),
        tonalElevation = if (selected) 6.dp else 0.dp,
        shadowElevation = if (selected) 10.dp else 0.dp
    ) {
        Box(
            modifier = Modifier
                .background(
                    Brush.horizontalGradient(
                        if (selected) listOf(accent.copy(alpha = 0.32f), accent.copy(alpha = 0.18f))
                        else listOf(Color.Transparent, Color.Transparent)
                    )
                )
                .padding(horizontal = VisusSpacing.md, vertical = VisusSpacing.xs),
            contentAlignment = Alignment.Center
        ) {
            Text(
                label,
                style = VisusTypography.label.copy(fontWeight = FontWeight.Bold),
                color = if (selected) accent else VisusPalette.textPrimary
            )
        }
    }
}

@Composable
fun VisusPrimaryButton(
    label: String,
    accent: Color = VisusPalette.accent2,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .height(48.dp),
        colors = ButtonDefaults.buttonColors(containerColor = accent)
    ) {
        Text(label, color = Color.Black, style = MaterialTheme.typography.labelLarge)
    }
}
