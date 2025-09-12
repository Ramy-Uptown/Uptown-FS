from playwright.sync_api import Page, expect

def test_arabic_number_conversion(page: Page):
    """
    This test verifies that when the Arabic language is selected, the numbers
    in the "Written Amount" column are correctly converted to Arabic text.
    """
    # 1. Arrange: Go to the calculator page.
    page.goto("http://localhost:5173")

    # 2. Act: Select the Arabic language.
    page.get_by_label("Language for Written Amounts").select_option("ar")

    # 3. Act: Generate a payment plan.
    page.get_by_role("button", name="Calculate (Generate Plan)").click()

    # 4. Assert: Verify that the "Written Amount" column contains Arabic text.
    # We will check for the presence of a common Arabic word like "فقط".
    expect(page.get_by_text("فقط")).to_be_visible()

    # 5. Screenshot: Capture the final result for visual verification.
    page.screenshot(path="arabic_number_verification.png")
