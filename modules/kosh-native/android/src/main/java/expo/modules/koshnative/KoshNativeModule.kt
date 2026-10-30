package expo.modules.koshnative

import android.Manifest
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.interfaces.permissions.Permissions
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android-only helpers for Kosh: reads bank SMS from the inbox and reports app usage
 * (for subscription tracking). Contract: src/lib/device.ts (KoshNativeModule).
 */
class KoshNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("KoshNative")

    AsyncFunction("hasSmsPermission") {
      hasSmsPermission()
    }

    AsyncFunction("requestSmsPermission") { promise: Promise ->
      if (hasSmsPermission()) {
        promise.resolve(true)
        return@AsyncFunction
      }
      val permissions = appContext.permissions
      if (permissions == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      permissions.askForPermissions(
        { result ->
          val granted = result[Manifest.permission.READ_SMS]?.status == PermissionsStatus.GRANTED
          promise.resolve(granted)
        },
        Manifest.permission.READ_SMS
      )
    }

    AsyncFunction("readSmsSince") { sinceMs: Double, limit: Int ->
      readSmsSince(sinceMs.toLong(), limit)
    }

    AsyncFunction("hasUsageAccess") {
      hasUsageAccess()
    }

    AsyncFunction("openUsageAccessSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        // Some OEMs support jumping straight to this app's toggle.
        data = Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      try {
        context.startActivity(intent)
      } catch (_: Exception) {
        context.startActivity(
          Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
    }

    AsyncFunction("getAppUsage") { packageNames: List<String>, sinceMs: Double ->
      getAppUsage(packageNames, sinceMs.toLong())
    }

    AsyncFunction("listInstalledApps") {
      listInstalledApps()
    }
  }

  private fun hasSmsPermission(): Boolean {
    val permissions: Permissions? = appContext.permissions
    if (permissions != null) return permissions.hasGrantedPermissions(Manifest.permission.READ_SMS)
    return context.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
  }

  private fun readSmsSince(sinceMs: Long, limit: Int): List<Map<String, Any>> {
    if (!hasSmsPermission()) throw Exceptions.MissingPermissions(Manifest.permission.READ_SMS)
    val out = ArrayList<Map<String, Any>>()
    if (limit <= 0) return out
    val cursor = context.contentResolver.query(
      Uri.parse("content://sms/inbox"),
      arrayOf("_id", "address", "body", "date"),
      "date > ?",
      arrayOf(sinceMs.toString()),
      "date ASC"
    ) ?: return out
    cursor.use { c ->
      val idCol = c.getColumnIndexOrThrow("_id")
      val addressCol = c.getColumnIndexOrThrow("address")
      val bodyCol = c.getColumnIndexOrThrow("body")
      val dateCol = c.getColumnIndexOrThrow("date")
      // Limit by iteration: "LIMIT" in sortOrder is not supported by every SMS provider.
      while (c.moveToNext() && out.size < limit) {
        out.add(
          mapOf(
            "id" to c.getLong(idCol).toString(),
            "address" to (c.getString(addressCol) ?: ""),
            "body" to (c.getString(bodyCol) ?: ""),
            "date" to c.getLong(dateCol).toDouble()
          )
        )
      }
    }
    return out
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    if (mode == AppOpsManager.MODE_DEFAULT) {
      return context.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) ==
        PackageManager.PERMISSION_GRANTED
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun getAppUsage(packageNames: List<String>, sinceMs: Long): List<Map<String, Any>> {
    val stats = if (hasUsageAccess()) {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      usm.queryAndAggregateUsageStats(sinceMs, System.currentTimeMillis()) ?: emptyMap()
    } else {
      emptyMap()
    }
    return packageNames.map { pkg ->
      val s = stats[pkg]
      mapOf(
        "packageName" to pkg,
        "lastTimeUsed" to (s?.lastTimeUsed ?: 0L).toDouble(),
        "totalTimeForegroundMs" to (s?.totalTimeInForeground ?: 0L).toDouble()
      )
    }
  }

  private fun listInstalledApps(): List<Map<String, Any>> {
    val pm = context.packageManager
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val infos = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0L))
    } else {
      @Suppress("DEPRECATION")
      pm.queryIntentActivities(intent, 0)
    }
    val own = context.packageName
    return infos
      .mapNotNull { info ->
        val pkg = info.activityInfo?.packageName ?: return@mapNotNull null
        if (pkg == own) return@mapNotNull null
        pkg to info.loadLabel(pm).toString()
      }
      .distinctBy { it.first }
      .sortedBy { it.second.lowercase() }
      .map { (pkg, label) -> mapOf("packageName" to pkg, "label" to label) }
  }
}
