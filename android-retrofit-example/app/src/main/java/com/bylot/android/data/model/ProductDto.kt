package com.bylot.android.data.model

import com.google.gson.annotations.SerializedName

data class ApiResponse<T>(
    @SerializedName("success")
    val success: Boolean,
    @SerializedName("message")
    val message: String? = null,
    @SerializedName("data")
    val data: T? = null
)

data class ProductDto(
    @SerializedName("id")
    val id: Long,
    @SerializedName("name")
    val name: String,
    @SerializedName("selling_price")
    val sellingPrice: Double? = null,
    @SerializedName("price")
    val rawPrice: Double? = null,
    @SerializedName("image_url")
    val imageUrl: String? = null,
    @SerializedName("image")
    val rawImage: String? = null,
    @SerializedName("country")
    val country: String? = null,
    @SerializedName("state")
    val state: String? = null,
    @SerializedName("district")
    val district: String? = null,
    @SerializedName("city")
    val city: String? = null,
    @SerializedName("locality")
    val locality: String? = null
)

data class Product(
    val id: Long,
    val name: String,
    val price: Double,
    val imageUrl: String?,
    val country: String? = null,
    val state: String? = null,
    val district: String? = null,
    val city: String? = null,
    val locality: String? = null
)

fun ProductDto.toDomain(baseUrl: String): Product {
    val raw = imageUrl ?: rawImage
    val normalizedImageUrl = when {
        raw.isNullOrBlank() -> null
        raw.startsWith("http://") || raw.startsWith("https://") -> raw
        else -> baseUrl.trimEnd('/') + "/" + raw.trimStart('/')
    }

    return Product(
        id = id,
        name = name,
        price = sellingPrice ?: rawPrice ?: 0.0,
        imageUrl = normalizedImageUrl,
        country = country,
        state = state,
        district = district,
        city = city,
        locality = locality
    )
}
