package com.visus.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.Shapes
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val VisusDark = darkColorScheme(
    primary = AccentCyan,
    secondary = AccentPink,
    tertiary = AccentPurple,
    background = DeepSpace,
    surface = Panel,
    onSurface = TextPrimary,
    onBackground = TextPrimary
)

@Composable
fun VisusTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) VisusDark else VisusDark
    MaterialTheme(
        colorScheme = colors,
        typography = androidx.compose.material3.Typography(),
        shapes = Shapes(),
        content = content
    )
}
