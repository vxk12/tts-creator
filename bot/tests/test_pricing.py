import base64
import unittest
from decimal import Decimal as D

from beta_catalog import CATALOG, extract_link, is_tiktok_link, product_from_link
from main import decode_payload
from pricing import TIER_BY_ID, fmt_eur, fmt_rate, parse_money, real_loss, tier_price


class PricingTest(unittest.TestCase):
    def test_tiers_example_27_eur_30_percent(self):
        purchase, rate = D("27"), D("0.30")
        expected = {"fair": ("18.90", "5.67"), "schnell": ("14.85", "8.51"), "sofort": ("10.80", "11.34")}
        for tier_id, (price, loss) in expected.items():
            p = tier_price(purchase, TIER_BY_ID[tier_id])
            self.assertEqual(p, D(price), tier_id)
            self.assertEqual(real_loss(purchase, p, rate), D(loss), tier_id)

    def test_zero_tax_means_full_loss(self):
        p = tier_price(D("50"), TIER_BY_ID["fair"])
        self.assertEqual(real_loss(D("50"), p, D("0")), D("15.00"))

    def test_parse_money(self):
        cases = {"27,90": "27.90", "27.90": "27.90", "27 €": "27.00", "1.299,00": "1299.00", "1,299.50": "1299.50"}
        for text, value in cases.items():
            self.assertEqual(parse_money(text), D(value), text)
        for bad in ["", "abc", "-5", "0", "0,00", "12,3,4"]:
            self.assertIsNone(parse_money(bad), bad)

    def test_format(self):
        self.assertEqual(fmt_eur(D("1299.9")), "1.299,90 €")
        self.assertEqual(fmt_eur(D("5.675")), "5,68 €")
        self.assertEqual(fmt_rate(D("0.30")), "30 %")
        self.assertEqual(fmt_rate(D("0.425")), "42,5 %")


class CatalogTest(unittest.TestCase):
    def test_links(self):
        self.assertEqual(extract_link("schau mal https://vm.tiktok.com/ZG9A86/ danke"), "https://vm.tiktok.com/ZG9A86/")
        self.assertTrue(is_tiktok_link("https://shop.tiktok.com/view/product/123"))
        self.assertTrue(is_tiktok_link("https://vm.tiktok.com/ZG9A86/"))
        self.assertFalse(is_tiktok_link("https://amazon.de/dp/123"))
        self.assertFalse(is_tiktok_link("https://tiktok.com.evil.example/x"))

    def test_beta_product_is_deterministic(self):
        link = "https://vm.tiktok.com/ZG9A86bGdeaah-ro48Q/"
        self.assertEqual(product_from_link(link), product_from_link(link))
        for product in CATALOG:
            self.assertTrue(product.image_file.exists(), product.image)

    def test_deep_link_payload(self):
        payload = base64.urlsafe_b64encode(b"test.creator").decode().rstrip("=")
        self.assertEqual(decode_payload(payload), "test.creator")
        self.assertIsNone(decode_payload("kauf_123"))
        self.assertIsNone(decode_payload(""))


if __name__ == "__main__":
    unittest.main()
