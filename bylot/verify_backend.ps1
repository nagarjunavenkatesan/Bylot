$ErrorActionPreference = "Stop"

function Invoke-Api {
    param(
        [string]$Url,
        [string]$Method = "POST",
        [hashtable]$Body
    )
    $JsonBody = $Body | ConvertTo-Json
    try {
        $Response = Invoke-WebRequest -Uri $Url -Method $Method -Body $JsonBody -ContentType "application/json" -UseBasicParsing
        return $Response
    } catch {
        Write-Host "Error calling $Url"
        Write-Host $_.Exception.Response.GetResponseStream()
        throw $_
    }
}

Write-Host "1. Testing Send OTP..."
$Phone = "9998887776"
$SendOtpUrl = "http://localhost:5000/api/auth/send-otp"
$OtpResponse = Invoke-Api -Url $SendOtpUrl -Body @{ phone = $Phone }
$OtpContent = $OtpResponse.Content | ConvertFrom-Json
Write-Host "Raw Response: $($OtpResponse.Content)"
$Otp = $OtpContent.otp
Write-Host "   OTP Received: $Otp"

if (-not $Otp) {
    throw "Failed to get OTP from response"
}

Write-Host "2. Testing Verify OTP..."
$VerifyOtpUrl = "http://localhost:5000/api/auth/verify-otp"
$VerifyResponse = Invoke-Api -Url $VerifyOtpUrl -Body @{ phone = $Phone; otp = $Otp }
Write-Host "   Verification: $($VerifyResponse.Content)"

Write-Host "3. Testing Register..."
$RegisterUrl = "http://localhost:5000/api/register"
$Email = "verify_$((Get-Date).Ticks)@example.com"
$RegisterBody = @{
    name = "Verification User"
    email = $Email
    phone = $Phone
    password = "password123"
}
$RegisterResponse = Invoke-Api -Url $RegisterUrl -Body $RegisterBody
Write-Host "   Register Status: $($RegisterResponse.StatusCode)"

Write-Host "4. Testing Login..."
$LoginUrl = "http://localhost:5000/api/login"
$LoginBody = @{
    email = $Email
    password = "password123"
}
$LoginResponse = Invoke-Api -Url $LoginUrl -Body $LoginBody
Write-Host "   Login Status: $($LoginResponse.StatusCode)"
$LoginContent = $LoginResponse.Content | ConvertFrom-Json
Write-Host "   Logged in User: $($LoginContent.user.name)"

Write-Host "Backend Verification Complete!"
