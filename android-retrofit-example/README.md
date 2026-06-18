# Bylot Android Retrofit Integration

This is a drop-in Kotlin + Jetpack Compose + Retrofit example for connecting an Android app to the same local Node.js/MySQL backend used by the website.

Backend endpoint:

```http
GET http://192.168.1.5:3000/products
```

Expected response:

```json
[
  {
    "id": 1,
    "name": "Milk",
    "price": 30,
    "image": "milk.png"
  }
]
```

## Localhost Rules

- Android Emulator cannot call your PC backend using `localhost`.
- Android Emulator should use `http://10.0.2.2:3000/`.
- A real Android phone should use your computer LAN IP, for example `http://192.168.1.5:3000/`.
- Phone and PC must be connected to the same WiFi network.
- Your backend must listen on `0.0.0.0` or your LAN IP, not only `127.0.0.1`.
- Windows Firewall must allow inbound traffic on port `3000`.

This example uses:

```kotlin
const val BASE_URL = "http://192.168.1.5:3000/"
```

It also sends this local API key header:

```http
x-api-key: 07dad0dd8d8e9ce8ffb28f53bd4156b75b2a61e22ee67c8fa4c4bca0a93a14c0
```

For emulator testing, change it to:

```kotlin
const val BASE_URL = "http://10.0.2.2:3000/"
```

## Run This Example

Open `android-retrofit-example` in Android Studio, let Gradle sync, then run the `app` configuration.

## Gradle Dependencies

The complete example already includes Gradle files:

- `settings.gradle.kts`
- `build.gradle.kts`
- `app/build.gradle.kts`

If you are copying into an existing app, add these dependencies to your app module `build.gradle.kts`:

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.bylot.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.bylot.android"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")

    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
```

## Files

Copy the files from `app/src/main/...` into your Android app module.

Important files:

- `AndroidManifest.xml`
- `res/xml/network_security_config.xml`
- `data/remote/RetrofitClient.kt`
- `data/remote/ApiService.kt`
- `data/model/ProductDto.kt`
- `data/repository/ProductRepository.kt`
- `ui/products/ProductViewModel.kt`
- `ui/products/ProductScreen.kt`
- `MainActivity.kt`
