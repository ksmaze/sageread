package com.xincmm.sageread

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class ProcessTextArgs {
    lateinit var text: String
}

@TauriPlugin
class AndroidSystemPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun processText(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(ProcessTextArgs::class.java)
            val selectedText = args.text.trim()

            if (selectedText.isEmpty()) {
                invoke.reject("Selected text is empty")
                return
            }

            val intent = Intent(Intent.ACTION_PROCESS_TEXT).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_PROCESS_TEXT, selectedText)
                putExtra(Intent.EXTRA_PROCESS_TEXT_READONLY, true)
            }

            if (intent.resolveActivity(activity.packageManager) == null) {
                invoke.reject("No apps can process selected text")
                return
            }

            activity.runOnUiThread {
                try {
                    activity.startActivity(Intent.createChooser(intent, "翻译"))
                    val result = JSObject().apply {
                        put("started", true)
                    }
                    invoke.resolve(result)
                } catch (_: ActivityNotFoundException) {
                    invoke.reject("No apps can process selected text")
                } catch (ex: Exception) {
                    invoke.reject(ex.message)
                }
            }
        } catch (ex: Exception) {
            invoke.reject(ex.message)
        }
    }
}
