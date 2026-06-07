package com.visus.app

/**
 * Container for shader sources and uniform names. Will be populated
 * once the web shader set is ported to GLSL ES 3.0.
 */
object ShaderLib {
    data class ShaderPreset(val name: String, val id: Int)

    val defaultPresets = listOf(
        ShaderPreset("None", 0),
        ShaderPreset("RGB Shift", 1),
        ShaderPreset("Glitch Lines", 3),
        ShaderPreset("Pixelate", 4),
        ShaderPreset("Neon Edges", 102)
    )
}
