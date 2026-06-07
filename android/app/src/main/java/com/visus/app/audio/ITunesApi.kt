package com.visus.app.audio

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class ITunesTrack(
    val id: String,
    val title: String,
    val artist: String,
    val previewUrl: String
)

object ITunesApi {
    suspend fun search(term: String, limit: Int = 10): List<ITunesTrack> = withContext(Dispatchers.IO) {
        val safeTerm = term.trim()
        if (safeTerm.isEmpty()) return@withContext emptyList()
        val url = URL("https://itunes.apple.com/search?media=music&term=${safeTerm.replace(" ", "+")}&limit=$limit")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 5000
            readTimeout = 5000
        }
        return@withContext conn.inputStream.use { stream ->
            val text = stream.bufferedReader().readText()
            val json = JSONObject(text)
            val results = json.optJSONArray("results") ?: return@use emptyList()
            (0 until results.length()).mapNotNull { i ->
                val obj = results.optJSONObject(i) ?: return@mapNotNull null
                val preview = obj.optString("previewUrl", "")
                if (preview.isBlank()) return@mapNotNull null
                ITunesTrack(
                    id = obj.optString("trackId", preview),
                    title = obj.optString("trackName", "Track"),
                    artist = obj.optString("artistName", "Artist"),
                    previewUrl = preview
                )
            }
        }
    }
}
