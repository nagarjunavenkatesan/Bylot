package com.bylot.android.data.remote

import com.bylot.android.data.model.ProductDto
import retrofit2.Response
import retrofit2.http.GET

interface ApiService {
    @GET("products")
    suspend fun getProducts(): Response<List<ProductDto>>
}
