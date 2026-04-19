import java.net.URI
import java.util.Properties

plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.android)
  alias(libs.plugins.kotlin.compose)
  alias(libs.plugins.kotlin.serialization)
}

val localProperties = Properties().apply {
  val file = rootProject.file("local.properties")
  if (file.exists()) {
    file.inputStream().use(::load)
  }
}

fun resolveGradleProperty(vararg names: String): String =
  names.firstNotNullOfOrNull { name ->
    providers.gradleProperty(name).orNull?.trim()?.takeIf { it.isNotEmpty() }
  }.orEmpty()

fun resolveLocalProperty(vararg names: String): String =
  names.firstNotNullOfOrNull { name ->
    localProperties.getProperty(name)?.trim()?.takeIf { it.isNotEmpty() }
  }.orEmpty()

fun extractHttpsOriginOrNull(value: String): String? {
  val rawValue = value.trim().trimEnd('/')
  if (rawValue.isBlank()) {
    return null
  }
  val uri = runCatching { URI(rawValue) }.getOrNull() ?: return null
  val scheme = uri.scheme?.lowercase() ?: return null
  val host = uri.host ?: return null
  if (scheme != "https") {
    return null
  }
  val port = uri.port
  return if (port == -1 || port == 443) {
    "$scheme://$host"
  } else {
    "$scheme://$host:$port"
  }
}

fun toBuildConfigString(value: String): String =
  "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

val configuredApiBaseUrl = resolveGradleProperty("API_BASE_URL")
  .ifBlank { resolveLocalProperty("API_BASE_URL") }
val configuredWsOrigin = resolveGradleProperty("wsOrigin", "WS_ORIGIN")
  .ifBlank { resolveLocalProperty("wsOrigin", "WS_ORIGIN") }

val debugApiBaseUrl = configuredApiBaseUrl.ifBlank { "http://10.0.2.2:8787" }
val releaseApiBaseUrl = configuredApiBaseUrl.ifBlank { "https://example.invalid" }
val debugWsOrigin = configuredWsOrigin.ifBlank { "http://localhost:3000" }
val releaseWsOrigin = extractHttpsOriginOrNull(configuredWsOrigin)
  ?: extractHttpsOriginOrNull(releaseApiBaseUrl)
  ?: "https://example.invalid"

android {
  namespace = "com.xyzw.helper"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.xyzw.helper"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "1.0.0"
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    vectorDrawables.useSupportLibrary = true
  }

  buildTypes {
    debug {
      applicationIdSuffix = ".debug"
      versionNameSuffix = "-debug"
      buildConfigField("String", "DEFAULT_API_BASE_URL", toBuildConfigString(debugApiBaseUrl))
      buildConfigField("String", "DEFAULT_WS_PATH", "\"/ws\"")
      buildConfigField("String", "DEFAULT_WS_ORIGIN", toBuildConfigString(debugWsOrigin))
    }
    release {
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro",
      )
      buildConfigField("String", "DEFAULT_API_BASE_URL", toBuildConfigString(releaseApiBaseUrl))
      buildConfigField("String", "DEFAULT_WS_PATH", "\"/ws\"")
      buildConfigField("String", "DEFAULT_WS_ORIGIN", toBuildConfigString(releaseWsOrigin))
    }
  }

  buildFeatures {
    compose = true
    buildConfig = true
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
    freeCompilerArgs += listOf(
      "-Xcontext-receivers",
    )
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }

  testOptions {
    unitTests.isReturnDefaultValues = true
    unitTests.isIncludeAndroidResources = true
  }
}

dependencies {
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.activity.compose)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.viewmodel.compose)
  implementation(libs.androidx.navigation.compose)
  implementation(libs.androidx.datastore.preferences)
  implementation(libs.androidx.security.crypto)
  implementation(libs.google.material)
  implementation(libs.kotlinx.coroutines.android)
  implementation(libs.kotlinx.serialization.json)
  implementation(libs.okhttp)
  implementation(libs.okhttp.logging)
  implementation(libs.retrofit)
  implementation(libs.retrofit.kotlinx.serialization)

  implementation(platform(libs.androidx.compose.bom))
  implementation(libs.androidx.compose.material.icons)
  implementation(libs.androidx.compose.ui)
  implementation(libs.androidx.compose.ui.graphics)
  implementation(libs.androidx.compose.ui.tooling.preview)
  implementation(libs.androidx.compose.material3)

  debugImplementation(platform(libs.androidx.compose.bom))
  debugImplementation(libs.androidx.compose.ui.tooling)
  debugImplementation(libs.androidx.compose.ui.test.manifest)

  testImplementation(platform(libs.androidx.compose.bom))
  testImplementation(libs.androidx.compose.ui.test.junit4)
  testImplementation(libs.androidx.test.core.ktx)
  testImplementation(libs.junit4)
  testImplementation(libs.kotlinx.coroutines.test)
  testImplementation(libs.okhttp.mockwebserver)
  testImplementation(libs.robolectric)
}
