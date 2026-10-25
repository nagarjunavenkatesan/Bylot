package com.bylot.android.data.model

import com.google.gson.annotations.SerializedName

data class StateDto(
    @SerializedName("code")
    val code: String,
    @SerializedName("name")
    val name: String,
    @SerializedName("type")
    val type: String
)

data class DistrictsResponseDto(
    @SerializedName("state")
    val state: String,
    @SerializedName("code")
    val code: String,
    @SerializedName("type")
    val type: String,
    @SerializedName("districts")
    val districts: List<String>
)
