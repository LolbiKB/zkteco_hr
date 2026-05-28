from setuptools import find_packages, setup


setup(
    name="zkteco_hr",
    version="0.0.1",
    description="ZKTeco attendance engine (Frappe/ERPNext HRMS) - MVP flags + weekly view",
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
)

