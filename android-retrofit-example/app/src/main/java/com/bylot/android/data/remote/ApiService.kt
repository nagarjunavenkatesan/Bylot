package com.bylot.android.data.remote

import com.bylot.android.data.model.ApiResponse
import com.bylot.android.data.model.DistrictsResponseDto
import com.bylot.android.data.model.ProductDto
import com.bylot.android.data.model.StateDto
import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Path

interface ApiService {
    @GET("products")
    suspend fun getProducts(): Response<ApiResponse<List<ProductDto>>>

    @DELETE("products/{id}")
    suspend fun deleteProduct(
        @Path("id") id: Long
    ): Response<ApiResponse<Unit>>

    @DELETE("sellers/products/{id}")
    suspend fun deleteSellerProduct(
        @Path("id") id: Long
    ): Response<ApiResponse<Unit>>

    @GET("locations/states")
    suspend fun getStates(): Response<ApiResponse<List<StateDto>>>

    @GET("locations/states/{codeOrState}/districts")
    suspend fun getDistricts(
        @Path("codeOrState") codeOrState: String
    ): Response<ApiResponse<DistrictsResponseDto>>
}

