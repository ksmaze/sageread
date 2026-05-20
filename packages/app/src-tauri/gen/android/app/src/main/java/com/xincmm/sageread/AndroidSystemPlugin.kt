package com.xincmm.sageread

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray

@InvokeArg
class ProcessTextArgs {
    lateinit var text: String
}

@TauriPlugin
class AndroidSystemPlugin(private val activity: Activity) : Plugin(activity) {
    private val openedBookUrls = linkedSetOf<String>()
    private val consumedIntentKeys = mutableSetOf<String>()

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

    @Command
    fun takeOpenedBookUrls(invoke: Invoke) {
        try {
            enqueueOpenedBookUrls(activity.intent)
            val urls = openedBookUrls.toList()
            openedBookUrls.clear()

            val result = JSObject().apply {
                put("urls", JSONArray(urls))
            }
            invoke.resolve(result)
        } catch (ex: Exception) {
            invoke.reject(ex.message)
        }
    }

    override fun onNewIntent(intent: Intent) {
        activity.setIntent(intent)
        enqueueOpenedBookUrls(intent)
    }

    private fun enqueueOpenedBookUrls(intent: Intent?) {
        val bookIntent = intent ?: return
        if (!isOpenBookIntent(bookIntent)) return

        val intentKey = openedBookIntentKey(bookIntent)
        if (!consumedIntentKeys.add(intentKey)) return

        openedBookUrls.addAll(extractOpenedBookUrls(bookIntent))
    }

    private fun isOpenBookIntent(intent: Intent): Boolean {
        val action = intent.action ?: return false
        return action == Intent.ACTION_VIEW || action == Intent.ACTION_SEND || action == Intent.ACTION_SEND_MULTIPLE
    }

    private fun openedBookIntentKey(intent: Intent): String {
        val uriParts = extractOpenedBookUrls(intent).joinToString("|")
        return listOf(intent.action.orEmpty(), intent.type.orEmpty(), uriParts).joinToString("::")
    }

    private fun extractOpenedBookUrls(intent: Intent): List<String> {
        val urls = linkedSetOf<String>()

        intent.dataString?.let(urls::add)

        val clipData = intent.clipData
        if (clipData != null) {
            for (index in 0 until clipData.itemCount) {
                clipData.getItemAt(index).uri?.toString()?.let(urls::add)
            }
        }

        val streamExtra = getStreamExtra(intent)
        streamExtra?.toString()?.let(urls::add)

        val streamExtras = getStreamExtras(intent)
        streamExtras?.forEach { uri -> urls.add(uri.toString()) }

        return urls.toList()
    }

    private fun getStreamExtra(intent: Intent): Uri? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }
    }

    private fun getStreamExtras(intent: Intent): ArrayList<Uri>? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
        }
    }
}
