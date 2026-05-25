package com.xincmm.sageread

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

private const val READER_FONT_LOG_TAG = "SageReadReaderFont"
private const val READER_FONT_LOG_PREFIX = "[SageRead:ReaderFont]"

@InvokeArg
class ProcessTextArgs {
    lateinit var text: String
}

@InvokeArg
class ReaderFontDiagnosticFont {
    lateinit var family: String
    lateinit var fileName: String
    var resourcePath: String? = null
    var sampleText: String? = null
    var fontFaceQuery: String? = null
    var resourceReadOk: Boolean = false
    var resourceByteLength: Long = 0
    var resourceErrorMessage: String? = null
    var nativeAssetPreparedOk: Boolean = false
    var nativeAssetByteLength: Long = 0
    var nativeAssetFilePath: String? = null
    var nativeAssetErrorMessage: String? = null
    var fontUrlKind: String? = null
    var cssMounted: Boolean = false
    var fontFaceSetStatus: String? = null
    var fontFaceLoadStatus: String? = null
    var fontFaceLoadedCount: Int = 0
    var fontFaceCheck: Boolean = false
    var fontFaceErrorMessage: String? = null
    var computedBodyContainsFamily: Boolean = false
    var computedDocumentElementContainsFamily: Boolean = false
}

@InvokeArg
class ReaderFontDiagnosticsArgs {
    var scope: String? = null
    var documentUrl: String? = null
    var computedBodyFontFamily: String? = null
    var computedDocumentElementFontFamily: String? = null
    lateinit var fonts: Array<ReaderFontDiagnosticFont>
}

@InvokeArg
class PrepareReaderFontAssetArgs {
    lateinit var resourcePath: String
}

private data class FontAssetStatus(
    val exists: Boolean,
    val byteLength: Long,
    val errorMessage: String?,
)

private data class PreparedFontAsset(
    val file: File,
    val byteLength: Long,
)

@TauriPlugin
class AndroidSystemPlugin(private val activity: Activity) : Plugin(activity) {
    private val openedBookUrls = linkedSetOf<String>()
    private val consumedIntentKeys = mutableSetOf<String>()
    private val fontAssetStatusByPath = mutableMapOf<String, FontAssetStatus>()
    private val preparedFontAssetsByPath = mutableMapOf<String, PreparedFontAsset>()

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

    @Command
    fun prepareReaderFontAsset(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(PrepareReaderFontAssetArgs::class.java)
            val prepared = prepareFontAsset(args.resourcePath)
            val result = JSObject().apply {
                put("filePath", prepared.file.absolutePath)
                put("byteLength", prepared.byteLength)
            }
            Log.i(
                READER_FONT_LOG_TAG,
                "$READER_FONT_LOG_PREFIX " + JSONObject()
                    .put("event", "native-asset-prepared")
                    .put("resourcePath", args.resourcePath)
                    .put("filePath", prepared.file.absolutePath)
                    .put("byteLength", prepared.byteLength)
                    .toString(),
            )
            invoke.resolve(result)
        } catch (ex: Exception) {
            Log.e(READER_FONT_LOG_TAG, "Failed to prepare reader font asset", ex)
            invoke.reject(ex.message)
        }
    }

    @Command
    fun logReaderFontDiagnostics(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(ReaderFontDiagnosticsArgs::class.java)
            val scope = args.scope ?: "unknown"
            val fonts = args.fonts.toList()

            Log.i(
                READER_FONT_LOG_TAG,
                "$READER_FONT_LOG_PREFIX " + JSONObject()
                    .put("event", "summary")
                    .put("scope", scope)
                    .put("documentUrl", args.documentUrl)
                    .put("fontCount", fonts.size)
                    .put("computedBodyFontFamily", args.computedBodyFontFamily)
                    .put("computedDocumentElementFontFamily", args.computedDocumentElementFontFamily)
                    .toString(),
            )

            fonts.forEach { font ->
                val resourcePath = font.resourcePath ?: "resources/fonts/${font.fileName}"
                val assetStatus = inspectFontAsset(resourcePath)
                val webViewLoadOk = font.cssMounted && font.fontFaceLoadedCount > 0 && font.fontFaceCheck
                val activeInComputedStack =
                    font.computedBodyContainsFamily || font.computedDocumentElementContainsFamily
                val logLevel = if (assetStatus.exists && (font.resourceReadOk || font.nativeAssetPreparedOk) && webViewLoadOk) {
                    Log.INFO
                } else {
                    Log.WARN
                }

                Log.println(
                    logLevel,
                    READER_FONT_LOG_TAG,
                    "$READER_FONT_LOG_PREFIX " + JSONObject()
                        .put("event", "font")
                        .put("scope", scope)
                        .put("family", font.family)
                        .put("fileName", font.fileName)
                        .put("resourcePath", resourcePath)
                        .put("apkAssetExists", assetStatus.exists)
                        .put("apkAssetBytes", assetStatus.byteLength)
                        .put("apkAssetError", assetStatus.errorMessage)
                        .put("tauriResourceReadOk", font.resourceReadOk)
                        .put("tauriResourceBytes", font.resourceByteLength)
                        .put("tauriResourceError", font.resourceErrorMessage)
                        .put("nativeAssetPreparedOk", font.nativeAssetPreparedOk)
                        .put("nativeAssetBytes", font.nativeAssetByteLength)
                        .put("nativeAssetFilePath", font.nativeAssetFilePath)
                        .put("nativeAssetError", font.nativeAssetErrorMessage)
                        .put("fontUrlKind", font.fontUrlKind)
                        .put("cssMounted", font.cssMounted)
                        .put("fontFaceSetStatus", font.fontFaceSetStatus)
                        .put("fontFaceLoadStatus", font.fontFaceLoadStatus)
                        .put("fontFaceLoadedCount", font.fontFaceLoadedCount)
                        .put("fontFaceCheck", font.fontFaceCheck)
                        .put("fontFaceError", font.fontFaceErrorMessage)
                        .put("sampleText", font.sampleText)
                        .put("fontFaceQuery", font.fontFaceQuery)
                        .put("webViewLoadOk", webViewLoadOk)
                        .put("activeInComputedStack", activeInComputedStack)
                        .put("activeEffective", webViewLoadOk && activeInComputedStack)
                        .toString(),
                )
            }

            invoke.resolve(JSObject().apply { put("logged", true) })
        } catch (ex: Exception) {
            Log.e(READER_FONT_LOG_TAG, "Failed to log reader font diagnostics", ex)
            invoke.reject(ex.message)
        }
    }

    override fun onNewIntent(intent: Intent) {
        activity.setIntent(intent)
        enqueueOpenedBookUrls(intent)
    }

    private fun prepareFontAsset(resourcePath: String): PreparedFontAsset {
        return preparedFontAssetsByPath.getOrPut(resourcePath) {
            val fileName = validatedFontFileName(resourcePath)
            val outputDir = File(activity.cacheDir, "reader-fonts-${appUpdateStamp()}").apply {
                if (!isDirectory && !mkdirs()) {
                    throw IllegalStateException("Failed to create font cache directory: $absolutePath")
                }
            }
            val outputFile = File(outputDir, fileName)

            if (outputFile.isFile && outputFile.length() > 0L) {
                return@getOrPut PreparedFontAsset(outputFile, outputFile.length())
            }

            val tempFile = File(outputDir, "$fileName.tmp")
            var totalBytes = 0L
            activity.assets.open(resourcePath).use { input ->
                FileOutputStream(tempFile).use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        totalBytes += read.toLong()
                    }
                }
            }

            require(totalBytes > 0L) { "Font asset is empty: $resourcePath" }
            if (outputFile.exists() && !outputFile.delete()) {
                throw IllegalStateException("Failed to replace cached font asset: ${outputFile.absolutePath}")
            }
            if (!tempFile.renameTo(outputFile)) {
                tempFile.copyTo(outputFile, overwrite = true)
                tempFile.delete()
            }
            PreparedFontAsset(outputFile, totalBytes)
        }
    }

    private fun validatedFontFileName(resourcePath: String): String {
        require(resourcePath.startsWith("resources/fonts/")) { "Invalid font asset path: $resourcePath" }
        require(resourcePath.endsWith(".woff2")) { "Invalid font asset path: $resourcePath" }
        require(resourcePath.split("/").none { it == ".." || it.isBlank() }) {
            "Invalid font asset path: $resourcePath"
        }
        val fileName = resourcePath.substringAfterLast("/")
        require(fileName.isNotBlank()) { "Invalid font asset path: $resourcePath" }
        return fileName
    }

    private fun appUpdateStamp(): Long {
        return try {
            activity.packageManager.getPackageInfo(activity.packageName, 0).lastUpdateTime
        } catch (_: Exception) {
            0L
        }
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

    private fun inspectFontAsset(resourcePath: String): FontAssetStatus {
        return fontAssetStatusByPath.getOrPut(resourcePath) {
            try {
                var totalBytes = 0L
                activity.assets.open(resourcePath).use { input ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        totalBytes += read.toLong()
                    }
                }
                FontAssetStatus(exists = true, byteLength = totalBytes, errorMessage = null)
            } catch (ex: Exception) {
                FontAssetStatus(exists = false, byteLength = 0, errorMessage = ex.message)
            }
        }
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
