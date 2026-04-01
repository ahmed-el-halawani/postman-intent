package com.intentpostman.handlers

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.os.Build
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.intentpostman.server.JsonRpcException

class PackageQueryHandler(private val context: Context) {

    /**
     * Returns all exported activities, services, and receivers from installed apps.
     */
    fun queryComponents(params: JsonObject?): JsonElement {
        val type = params?.get("type")?.asString // "activity", "service", "receiver", or null for all
        val packageFilter = params?.get("package")?.asString // optional filter by package

        val result = JsonObject()

        if (type == null || type == "activity") {
            result.add("activities", queryActivities(packageFilter))
        }
        if (type == null || type == "service") {
            result.add("services", queryServices(packageFilter))
        }
        if (type == null || type == "receiver") {
            result.add("receivers", queryReceivers(packageFilter))
        }

        return result
    }

    /**
     * Returns a list of common quick-action intents and intents resolved from the device.
     */
    fun getQuickActions(params: JsonObject?): JsonElement {
        val result = JsonArray()

        // Common system intents
        addCommonIntents(result)

        // Query device for resolvable intents from installed apps
        addDeviceIntents(result)

        return result
    }

    /**
     * Lists all installed packages with their exported components.
     */
    fun listPackages(params: JsonObject?): JsonElement {
        val pm = context.packageManager
        val packages = pm.getInstalledPackages(0)
        val result = JsonArray()

        for (pkg in packages) {
            val obj = JsonObject()
            obj.addProperty("packageName", pkg.packageName)
            obj.addProperty("versionName", pkg.versionName ?: "")
            obj.addProperty("label", pm.getApplicationLabel(pkg.applicationInfo!!).toString())
            result.add(obj)
        }

        return result
    }

    /**
     * Query all intent filters for a specific package.
     */
    fun queryPackageIntents(params: JsonObject?): JsonElement {
        val packageName = params?.get("package")?.asString
            ?: throw JsonRpcException(-32602, "Missing 'package' param")

        val pm = context.packageManager
        val result = JsonObject()

        // Activities
        try {
            val packageInfo = pm.getPackageInfo(
                packageName,
                PackageManager.GET_ACTIVITIES or PackageManager.GET_INTENT_FILTERS
            )
            val activities = JsonArray()
            packageInfo.activities?.forEach { actInfo ->
                if (actInfo.exported) {
                    val obj = JsonObject()
                    obj.addProperty("name", actInfo.name)
                    obj.addProperty("label", actInfo.loadLabel(pm).toString())
                    obj.addProperty("component", "${packageName}/${actInfo.name}")
                    activities.add(obj)
                }
            }
            result.add("activities", activities)
        } catch (_: Exception) {}

        // Services
        try {
            val packageInfo = pm.getPackageInfo(
                packageName,
                PackageManager.GET_SERVICES
            )
            val services = JsonArray()
            packageInfo.services?.forEach { svcInfo ->
                if (svcInfo.exported) {
                    val obj = JsonObject()
                    obj.addProperty("name", svcInfo.name)
                    obj.addProperty("component", "${packageName}/${svcInfo.name}")
                    services.add(obj)
                }
            }
            result.add("services", services)
        } catch (_: Exception) {}

        // Receivers
        try {
            val packageInfo = pm.getPackageInfo(
                packageName,
                PackageManager.GET_RECEIVERS
            )
            val receivers = JsonArray()
            packageInfo.receivers?.forEach { recInfo ->
                if (recInfo.exported) {
                    val obj = JsonObject()
                    obj.addProperty("name", recInfo.name)
                    obj.addProperty("component", "${packageName}/${recInfo.name}")
                    receivers.add(obj)
                }
            }
            result.add("receivers", receivers)
        } catch (_: Exception) {}

        return result
    }

    private fun queryActivities(packageFilter: String?): JsonArray {
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN).apply {
            if (packageFilter != null) setPackage(packageFilter)
        }
        val resolveInfos = pm.queryIntentActivities(intent, PackageManager.GET_RESOLVED_FILTER)
        return resolveInfoListToJson(resolveInfos, pm, "activity")
    }

    private fun queryServices(packageFilter: String?): JsonArray {
        val pm = context.packageManager
        val intent = Intent().apply {
            if (packageFilter != null) setPackage(packageFilter)
        }
        // Query all services - can't easily query all, so get from packages
        val result = JsonArray()
        val packages = if (packageFilter != null) {
            listOf(packageFilter)
        } else {
            pm.getInstalledPackages(0).map { it.packageName }
        }

        for (pkg in packages) {
            try {
                val pkgInfo = pm.getPackageInfo(pkg, PackageManager.GET_SERVICES)
                pkgInfo.services?.forEach { svc ->
                    if (svc.exported) {
                        val obj = JsonObject()
                        obj.addProperty("type", "service")
                        obj.addProperty("package", pkg)
                        obj.addProperty("name", svc.name)
                        obj.addProperty("component", "$pkg/${svc.name}")
                        obj.addProperty("label", svc.loadLabel(pm)?.toString() ?: svc.name.substringAfterLast('.'))
                        result.add(obj)
                    }
                }
            } catch (_: Exception) {}
        }
        return result
    }

    private fun queryReceivers(packageFilter: String?): JsonArray {
        val pm = context.packageManager
        val result = JsonArray()
        val packages = if (packageFilter != null) {
            listOf(packageFilter)
        } else {
            pm.getInstalledPackages(0).map { it.packageName }
        }

        for (pkg in packages) {
            try {
                val pkgInfo = pm.getPackageInfo(pkg, PackageManager.GET_RECEIVERS)
                pkgInfo.receivers?.forEach { rec ->
                    if (rec.exported) {
                        val obj = JsonObject()
                        obj.addProperty("type", "receiver")
                        obj.addProperty("package", pkg)
                        obj.addProperty("name", rec.name)
                        obj.addProperty("component", "$pkg/${rec.name}")
                        obj.addProperty("label", rec.loadLabel(pm)?.toString() ?: rec.name.substringAfterLast('.'))
                        result.add(obj)
                    }
                }
            } catch (_: Exception) {}
        }
        return result
    }

    private fun resolveInfoListToJson(list: List<ResolveInfo>, pm: PackageManager, type: String): JsonArray {
        val result = JsonArray()
        for (info in list) {
            val actInfo = info.activityInfo ?: continue
            val obj = JsonObject()
            obj.addProperty("type", type)
            obj.addProperty("package", actInfo.packageName)
            obj.addProperty("name", actInfo.name)
            obj.addProperty("component", "${actInfo.packageName}/${actInfo.name}")
            obj.addProperty("label", info.loadLabel(pm).toString())
            obj.addProperty("exported", actInfo.exported)

            // Include intent filter actions if available
            val filter = info.filter
            if (filter != null) {
                val actions = JsonArray()
                for (i in 0 until filter.countActions()) {
                    actions.add(filter.getAction(i))
                }
                obj.add("actions", actions)

                val categories = JsonArray()
                for (i in 0 until filter.countCategories()) {
                    categories.add(filter.getCategory(i))
                }
                obj.add("categories", categories)

                val dataSchemes = JsonArray()
                for (i in 0 until filter.countDataSchemes()) {
                    dataSchemes.add(filter.getDataScheme(i))
                }
                obj.add("dataSchemes", dataSchemes)
            }

            result.add(obj)
        }
        return result
    }

    private fun addCommonIntents(result: JsonArray) {
        val commons = listOf(
            QuickAction("Open URL", "activity", "android.intent.action.VIEW", data = "https://"),
            QuickAction("Share Text", "activity", "android.intent.action.SEND", mimeType = "text/plain", extras = mapOf("android.intent.extra.TEXT" to "Hello")),
            QuickAction("Send Email", "activity", "android.intent.action.SENDTO", data = "mailto:"),
            QuickAction("Dial Number", "activity", "android.intent.action.DIAL", data = "tel:"),
            QuickAction("Call Number", "activity", "android.intent.action.CALL", data = "tel:"),
            QuickAction("Open Settings", "activity", "android.settings.SETTINGS"),
            QuickAction("WiFi Settings", "activity", "android.settings.WIFI_SETTINGS"),
            QuickAction("Bluetooth Settings", "activity", "android.settings.BLUETOOTH_SETTINGS"),
            QuickAction("App Details", "activity", "android.settings.APPLICATION_DETAILS_SETTINGS", data = "package:com.example"),
            QuickAction("Pick Image", "activity", "android.intent.action.PICK", data = "content://media/external/images/media", forResult = true),
            QuickAction("Pick Contact", "activity", "android.intent.action.PICK", data = "content://com.android.contacts/contacts", forResult = true),
            QuickAction("Take Photo", "activity", "android.media.action.IMAGE_CAPTURE", forResult = true),
            QuickAction("Record Video", "activity", "android.media.action.VIDEO_CAPTURE", forResult = true),
            QuickAction("Get Content (Any File)", "activity", "android.intent.action.GET_CONTENT", mimeType = "*/*", forResult = true),
            QuickAction("Get Content (Image)", "activity", "android.intent.action.GET_CONTENT", mimeType = "image/*", forResult = true),
            QuickAction("Create Document", "activity", "android.intent.action.CREATE_DOCUMENT", mimeType = "text/plain", forResult = true),
            QuickAction("Web Search", "activity", "android.intent.action.WEB_SEARCH", extras = mapOf("query" to "test")),
            QuickAction("Open Map", "activity", "android.intent.action.VIEW", data = "geo:0,0?q="),
            QuickAction("Open Calendar", "activity", "android.intent.action.VIEW", data = "content://com.android.calendar/time/"),
            QuickAction("Battery Changed", "broadcast", "android.intent.action.BATTERY_CHANGED"),
            QuickAction("Screen On", "broadcast", "android.intent.action.SCREEN_ON"),
            QuickAction("Screen Off", "broadcast", "android.intent.action.SCREEN_OFF"),
            QuickAction("Airplane Mode", "broadcast", "android.intent.action.AIRPLANE_MODE"),
            QuickAction("Custom Broadcast", "broadcast", "com.intentpostman.TEST_BROADCAST"),
        )

        for (action in commons) {
            val obj = JsonObject()
            obj.addProperty("label", action.label)
            obj.addProperty("type", action.type)
            obj.addProperty("action", action.action)
            obj.addProperty("source", "common")
            obj.addProperty("forResult", action.forResult)
            if (action.data != null) obj.addProperty("data", action.data)
            if (action.mimeType != null) obj.addProperty("mimeType", action.mimeType)
            if (action.extras != null) {
                val extrasArr = JsonArray()
                for ((key, value) in action.extras) {
                    val extraObj = JsonObject()
                    extraObj.addProperty("key", key)
                    extraObj.addProperty("type", "string")
                    extraObj.addProperty("value", value)
                    extrasArr.add(extraObj)
                }
                obj.add("extras", extrasArr)
            }
            result.add(obj)
        }
    }

    private fun addDeviceIntents(result: JsonArray) {
        val pm = context.packageManager

        // Query shareable activities
        val shareIntent = Intent(Intent.ACTION_SEND).apply { type = "text/plain" }
        val shareTargets = pm.queryIntentActivities(shareIntent, 0)
        for (info in shareTargets.take(20)) {
            val actInfo = info.activityInfo ?: continue
            val obj = JsonObject()
            obj.addProperty("label", "Share to ${info.loadLabel(pm)}")
            obj.addProperty("type", "activity")
            obj.addProperty("action", "android.intent.action.SEND")
            obj.addProperty("source", "device")
            obj.addProperty("component", "${actInfo.packageName}/${actInfo.name}")
            obj.addProperty("forResult", false)
            result.add(obj)
        }

        // Query viewable content handlers
        val viewIntent = Intent(Intent.ACTION_VIEW).apply {
            data = android.net.Uri.parse("https://example.com")
        }
        val viewTargets = pm.queryIntentActivities(viewIntent, 0)
        for (info in viewTargets.take(10)) {
            val actInfo = info.activityInfo ?: continue
            val obj = JsonObject()
            obj.addProperty("label", "Open URL with ${info.loadLabel(pm)}")
            obj.addProperty("type", "activity")
            obj.addProperty("action", "android.intent.action.VIEW")
            obj.addProperty("source", "device")
            obj.addProperty("component", "${actInfo.packageName}/${actInfo.name}")
            obj.addProperty("data", "https://")
            obj.addProperty("forResult", false)
            result.add(obj)
        }
    }

    private data class QuickAction(
        val label: String,
        val type: String,
        val action: String,
        val data: String? = null,
        val mimeType: String? = null,
        val extras: Map<String, String>? = null,
        val forResult: Boolean = false,
    )
}
