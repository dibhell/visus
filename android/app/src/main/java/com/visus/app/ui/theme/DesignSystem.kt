package com.visus.app.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object VisusSpacing {
    val xs = 6.dp
    val sm = 10.dp
    val md = 14.dp
    val lg = 18.dp
    val xl = 24.dp
}

object VisusRadius {
    val sm = 10.dp
    val md = 14.dp
    val lg = 18.dp
    val pill = 999.dp
}

object VisusTypography {
    val title = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Black,
        fontSize = 14.sp,
        letterSpacing = 0.8.sp
    )
    val body = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp
    )
    val label = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
        letterSpacing = 0.5.sp
    )
}

object VisusPalette {
    val panel = Panel
    val panelStroke = PanelStroke
    val accent1 = AccentPurple
    val accent2 = AccentCyan
    val accent3 = AccentPink
    val textPrimary = TextPrimary
    val textMuted = TextMuted
    val success = AccentLime
    val danger = MeterRed
}
