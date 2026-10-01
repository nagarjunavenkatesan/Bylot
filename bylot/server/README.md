# Obsolete Development Prototype Notice

> **IMPORTANT ARCHITECTURAL NOTICE:**
> The directory `bylot/server/` is an **early monolithic development prototype**.
>
> The **central production backend** is located in `/backend` (Express, MySQL connection pooling, JWT authentication, Google Auth verification, RBAC, Helmet, rate limiting, and centralized error handling).
>
> DO NOT run or deploy `bylot/server` in production. All APIs consumed by the React frontend (`bylot/src/api/backendApi.js`) and Android application route to `/backend`.
