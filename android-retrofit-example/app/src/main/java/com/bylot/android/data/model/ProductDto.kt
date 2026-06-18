package com.bylot.android.data.model

import com.google.gson.annotations.SerializedName

data class ProductDto(
    @SerializedName("id")
    val id: Long,
    @SerializedName("name")
    val name: String,
    @SerializedName("price")
    val price: Double,
    @SerializedName("image")
    val image: String?
)

data class Product(
    val id: Long,
    val name: String,
    val price: Double,
    val imageUrl: String?
)

fun ProductDto.toDomain(baseUrl: String): Product {
    val normalizedImageUrl = when {
        image.isNullOrBlank() -> null
        image.startsWith("http://") || image.startsWith("https://") -> image
        else -> baseUrl.trimEnd('/') + "/" + image.trimStart('/')
    }

    return Product(
        id = id,
        name = name,
        price = price,
        imageUrl = normalizedImageUrl
    )
}
