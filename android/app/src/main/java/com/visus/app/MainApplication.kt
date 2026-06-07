package com.visus.app

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

class MainApplication : Application() {
    // Global scope for lightweight, app-wide tasks (no heavy work on startup)
    val appScope by lazy { CoroutineScope(SupervisorJob() + Dispatchers.Default) }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: MainApplication
            private set
    }
}
