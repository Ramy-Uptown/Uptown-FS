from playwright.sync_api import Page, expect

def test_arabic_month_translation(page: Page):
    """
    This test verifies that when the Arabic language is selected, the month
    number is correctly translated to its Arabic name.
    """
    # 1. Arrange: Go to the calculator page.
    page.goto("http://localhost:5173")

    # 2. Act: Select the Arabic language.
    page.get_by_label("Language for Written Amounts").select_option("ar")

    # 3. Act: Enable "Split First Year Payments".
    page.get_by_label("Split First Year Payments?").check()

    # 4. Act: Add a first-year payment.
    page.get_by_role("button", name="+ Add Payment").click()

    # 5. Assert: Verify that the Arabic month name is displayed.
    # The default month is 1, which is January (يناير).
    expect(page.get_by_text("يناير")).to_be_visible()

    # 6. Screenshot: Capture the final result for visual verification.
    page.screenshot(path="/tmp/arabic_month_verification.png")
