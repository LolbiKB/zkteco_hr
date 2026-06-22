import frappe

NAME = "ADMS Bridge"
APP = "dewey_time"
MODULE = "Dewey Time"
ADMS_URL = "/adms"
LOGO = "/assets/dewey_time/images/adms-bridge.svg"
ICON = "tool"


def execute():
    """Give ADMS a real Desk icon — the v16 trio: Workspace + Workspace Sidebar + Desktop Icon.

    v16 renders a Desktop Icon only when a same-label Workspace Sidebar has a
    visible item (frappe.desk.doctype.desktop_icon.get_desktop_icons), and a
    sidebar is visible only when it holds at least one allowed Workspace/DocType
    item (frappe.boot.get_sidebar_items). A lone URL Workspace (the earlier
    add_adms_bridge_desk_link attempt) therefore never surfaced. This mirrors
    the structure that worked before, pointed at /adms, with the ADMS Bridge
    mark as the tile logo. Idempotent — safe to re-run on every migrate.
    """
    _upsert_workspace()
    _upsert_sidebar()
    _upsert_desktop_icon()
    frappe.clear_cache()


def _upsert_workspace():
    content = frappe.as_json(
        [
            {"type": "header", "data": {"text": NAME, "col": 12}},
            {
                "type": "shortcut",
                "data": {
                    "shortcut_name": "Open ADMS Dashboard",
                    "label": "Open ADMS Dashboard",
                    "link_to": ADMS_URL,
                    "link_type": "URL",
                    "color": "Green",
                    "col": 4,
                },
            },
        ]
    )
    fields = {
        "type": "Workspace",
        "external_link": None,
        "title": NAME,
        "label": NAME,
        "module": MODULE,
        "app": APP,
        "icon": ICON,
        "public": 1,
        "is_hidden": 0,
        "content": content,
    }

    if frappe.db.exists("Workspace", NAME):
        doc = frappe.get_doc("Workspace", NAME)
        doc.update(fields)
        doc.shortcuts = []
    else:
        doc = frappe.new_doc("Workspace")
        doc.name = NAME
        doc.update(fields)

    doc.append(
        "shortcuts",
        {"label": "Open ADMS Dashboard", "type": "URL", "url": ADMS_URL, "color": "Green"},
    )
    doc.save(ignore_permissions=True)


def _upsert_sidebar():
    items = [
        # a real Workspace item — this is what makes the sidebar (and so the
        # Desktop Icon) pass the v16 visibility gate
        {
            "label": NAME,
            "link_to": NAME,
            "link_type": "Workspace",
            "type": "Link",
            "child": 0,
            "collapsible": 1,
            "indent": 0,
            "keep_closed": 0,
            "show_arrow": 0,
        },
        # a direct link to the dashboard
        {
            "label": "Open ADMS Dashboard",
            "link_to": ADMS_URL,
            "link_type": "URL",
            "type": "Link",
            "child": 0,
            "collapsible": 1,
            "indent": 0,
            "keep_closed": 0,
            "show_arrow": 0,
        },
    ]

    if frappe.db.exists("Workspace Sidebar", NAME):
        doc = frappe.get_doc("Workspace Sidebar", NAME)
        doc.items = []
    else:
        doc = frappe.new_doc("Workspace Sidebar")
        doc.title = NAME

    doc.update({"app": APP, "module": MODULE, "header_icon": ICON, "standard": 1})
    for item in items:
        doc.append("items", item)
    doc.save(ignore_permissions=True)


def _upsert_desktop_icon():
    fields = {
        "label": NAME,
        "icon_type": "Link",
        "link_type": "External",
        "link": ADMS_URL,
        "logo_url": LOGO,
        "icon": ICON,
        "standard": 1,
        "app": APP,
        "hidden": 0,
        "bg_color": "gray",
    }

    existing = frappe.db.get_value("Desktop Icon", {"label": NAME})
    if existing:
        doc = frappe.get_doc("Desktop Icon", existing)
        doc.update(fields)
    else:
        doc = frappe.new_doc("Desktop Icon")
        doc.update(fields)
    doc.save(ignore_permissions=True)
