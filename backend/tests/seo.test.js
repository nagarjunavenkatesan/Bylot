const request = require("supertest");
const app = require("../app");

describe("SEO & SPA 404 Route Handling Integration Tests", () => {
  describe("GET /robots.txt", () => {
    it("should return HTTP 200 text/plain with Sitemap location and Disallow rules", async () => {
      const res = await request(app).get("/robots.txt");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/plain/);
      expect(res.text).toContain("User-agent: *");
      expect(res.text).toContain("Disallow: /admin");
      expect(res.text).toContain("Disallow: /api/");
      expect(res.text).toContain("Sitemap: https://bylot.in/sitemap.xml");
    });
  });

  describe("GET /sitemap.xml and partition endpoints", () => {
    it("should return master sitemap index XML", async () => {
      const res = await request(app).get("/sitemap.xml");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/xml/);
      expect(res.text).toContain("<sitemapindex");
      expect(res.text).toContain("sitemap-pages.xml");
      expect(res.text).toContain("sitemap-categories.xml");
      expect(res.text).toContain("sitemap-locations.xml");
      expect(res.text).toContain("sitemap-products-1.xml");
    });

    it("should return pages sitemap XML", async () => {
      const res = await request(app).get("/sitemap-pages.xml");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/xml/);
      expect(res.text).toContain("<urlset");
      expect(res.text).toContain("https://bylot.in/about");
    });

    it("should return categories sitemap XML", async () => {
      const res = await request(app).get("/sitemap-categories.xml");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/xml/);
      expect(res.text).toContain("<urlset");
      expect(res.text).toContain("https://bylot.in/category/");
    });

    it("should return locations sitemap XML", async () => {
      const res = await request(app).get("/sitemap-locations.xml");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/xml/);
      expect(res.text).toContain("<urlset");
      expect(res.text).toContain("https://bylot.in/location/bengaluru");
    });

    it("should return product sitemap partition XML", async () => {
      const res = await request(app).get("/sitemap-products-1.xml");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/xml/);
      expect(res.text).toContain("<urlset");
    });
  });

  describe("SPA Route 404 vs 200 HTTP status code responses", () => {
    it("should return HTTP 404 for non-existent product", async () => {
      const res = await request(app).get("/product/99999999");
      expect(res.status).toBe(404);
      expect(res.text).toContain("Product Not Found | Bylot");
      expect(res.text).toContain('name="robots" content="noindex, nofollow"');
    });

    it("should return HTTP 404 for invalid category", async () => {
      const res = await request(app).get("/category/invalid-nonexistent-category-slug");
      expect(res.status).toBe(404);
      expect(res.text).toContain("Category Not Found | Bylot");
      expect(res.text).toContain('name="robots" content="noindex, nofollow"');
    });

    it("should return HTTP 404 for invalid location", async () => {
      const res = await request(app).get("/location/invalid-nonexistent-city");
      expect(res.status).toBe(404);
      expect(res.text).toContain("Location Not Found | Bylot");
      expect(res.text).toContain('name="robots" content="noindex, nofollow"');
    });

    it("should return HTTP 404 for invalid seller", async () => {
      const res = await request(app).get("/seller/99999999");
      expect(res.status).toBe(404);
      expect(res.text).toContain("Seller Profile Not Found | Bylot");
      expect(res.text).toContain('name="robots" content="noindex, nofollow"');
    });

    it("should return HTTP 404 for completely unknown route", async () => {
      const res = await request(app).get("/random-unknown-invalid-route-xyz");
      expect(res.status).toBe(404);
      expect(res.text).toContain("404 Page Not Found | Bylot");
      expect(res.text).toContain('name="robots" content="noindex, nofollow"');
    });

    it("should return HTTP 200 for valid category", async () => {
      const res = await request(app).get("/category/groceries");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Groceries");
    });

    it("should return HTTP 200 for valid location", async () => {
      const res = await request(app).get("/location/bengaluru");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Bengaluru");
    });
  });
});
