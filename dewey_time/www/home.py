import frappe

no_cache = 1


def get_context(context):
    # Gate the shell so Guests land on login instead of a broken page.
    if frappe.session.user in (None, "", "Guest"):
        frappe.local.flags.redirect_location = "/login?redirect-to=/home"
        raise frappe.Redirect

    csrf_token = frappe.sessions.get_csrf_token()
    frappe.db.commit()

    context.update({"csrf_token": csrf_token})
    return context
