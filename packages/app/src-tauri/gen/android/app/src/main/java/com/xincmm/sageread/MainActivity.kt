package com.xincmm.sageread

import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.webkit.WebView
import android.app.ActivityManager
import android.graphics.Color
import android.util.Log
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import androidx.activity.enableEdgeToEdge
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat


class MainActivity : TauriActivity() {
    private var currentWebView: WebView? = null
    private var isKeyboardVisible: Boolean = false
    private var interceptVolumeKeysEnabled = false
    private var interceptBackKeyEnabled = false

    private val keyEventMap = mapOf(
        KeyEvent.KEYCODE_BACK to "Back",
        KeyEvent.KEYCODE_VOLUME_DOWN to "VolumeDown",
        KeyEvent.KEYCODE_VOLUME_UP to "VolumeUp"
    )

    private external fun java_init(context: android.content.Context): Boolean

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        java_init(this)

        // Allow content to extend under the system bars
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Handle display cutout (notch)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                    android.view.WindowManager.LayoutParams
                            .LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        // Set task description for recents
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            setTaskDescription(
                ActivityManager.TaskDescription(
                    getString(R.string.app_name),
                    null,
                    Color.TRANSPARENT
                )
            )
        }

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content)) {
                view: View,
                insets: WindowInsetsCompat ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            // Use max of system bar bottom and IME bottom to handle keyboard properly
            val bottomInset = maxOf(systemBars.bottom, ime.bottom)
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, bottomInset)
            isKeyboardVisible = ime.bottom > 0
            insets
        }

        // Android 13+ predictive back gesture support
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                OnBackInvokedCallback {
                    Log.d("MainActivity", "Back invoked callback triggered $interceptBackKeyEnabled")
                    if (interceptBackKeyEnabled) {
                        currentWebView?.evaluateJavascript(
                            """window.onNativeKeyDown("Back", ${KeyEvent.KEYCODE_BACK});""",
                            null
                        )
                    } else {
                        handleBackNavigation()
                    }
                }
            )
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (interceptBackKeyEnabled) {
                    Log.d("MainActivity", "Back intercepted (OnBackPressedDispatcher)")
                    currentWebView?.evaluateJavascript(
                        """window.onNativeKeyDown("Back", ${KeyEvent.KEYCODE_BACK});""",
                        null
                    )
                } else {
                    handleBackNavigation()
                }
            }
        })
    }

    private fun handleBackNavigation() {
        val backForwardList = currentWebView?.copyBackForwardList()
        val currentIndex = backForwardList?.currentIndex ?: 0
        val canGoBack = currentIndex > 0

        if (canGoBack) {
            currentWebView?.evaluateJavascript("history.back();", null)
        } else {
            moveTaskToBack(true)
        }
    }

    override fun onWebViewCreate(webView: WebView) {
        currentWebView = webView
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false
        // Intercept touch events to prevent scrolling
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER)
    }

    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        val action = when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> "touchstart"
            MotionEvent.ACTION_UP -> "touchend"
            MotionEvent.ACTION_CANCEL -> "touchcancel"
            MotionEvent.ACTION_POINTER_DOWN -> "touchstart"
            MotionEvent.ACTION_POINTER_UP -> "touchend"
            else -> null
        }

        action?.let { eventType ->
            val pointerIndex = event.actionIndex
            val pointerId = event.getPointerId(pointerIndex)
            val x = event.getX(pointerIndex)
            val y = event.getY(pointerIndex)
            val pressure = event.getPressure(pointerIndex)

            currentWebView?.evaluateJavascript(
                """
                try {
                    if (window.onNativeTouch) {
                        window.onNativeTouch({
                            type: "$eventType",
                            pointerId: $pointerId,
                            x: $x,
                            y: $y,
                            pressure: $pressure,
                            pointerCount: ${event.pointerCount},
                            timestamp: ${event.eventTime}
                        });
                    }
                } catch (err) {
                    console.error('Native touch error:', err);
                }
                """.trimIndent(),
                null
            )
        }

        return super.dispatchTouchEvent(event)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            val keyCode = event.keyCode
            val keyName = keyEventMap[keyCode]

            if (keyName != null) {
                val shouldIntercept = when (keyCode) {
                    KeyEvent.KEYCODE_BACK -> interceptBackKeyEnabled
                    KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_VOLUME_DOWN -> interceptVolumeKeysEnabled
                    else -> false
                }

                if (shouldIntercept) {
                    currentWebView?.evaluateJavascript(
                        """
                        try { window.onNativeKeyDown("$keyName", $keyCode); } catch (_) {}
                        """.trimIndent(),
                        null
                    )
                    return true
                }
            }

            // Handle back key normally when not intercepted
            if (keyCode == KeyEvent.KEYCODE_BACK) {
                handleBackNavigation()
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    // Call these from JS via Tauri commands to enable/disable key interception
    fun setInterceptVolumeKeys(enabled: Boolean) {
        Log.d("MainActivity", "Intercept volume keys: $enabled")
        interceptVolumeKeysEnabled = enabled
    }

    fun setInterceptBackKey(enabled: Boolean) {
        Log.d("MainActivity", "Intercept back key: $enabled")
        interceptBackKeyEnabled = enabled
    }
}
