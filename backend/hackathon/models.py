from django.db import models


class LegacyEmployeeMaster(models.Model):
    emp_id = models.PositiveIntegerField(primary_key=True)
    first_name = models.CharField(max_length=50)
    middle_name = models.CharField(max_length=50, null=True, blank=True)
    last_name = models.CharField(max_length=50)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'emp_master'


class LegacyEmployeeBankInfo(models.Model):
    emp_bank_id = models.PositiveIntegerField(primary_key=True)
    emp_id = models.PositiveIntegerField()
    bank_acct_no = models.CharField(max_length=32)
    ifsc_code = models.CharField(max_length=20)
    branch_name = models.CharField(max_length=100)
    bank_name = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = 'emp_bank_info'


class LegacyEmployeeRegInfo(models.Model):
    emp_reg_info_id = models.PositiveIntegerField(primary_key=True)
    emp_id = models.PositiveIntegerField()
    pan = models.CharField(max_length=20)
    aadhaar = models.CharField(max_length=20)
    uan_epf_acctno = models.CharField(max_length=30)
    esi = models.CharField(max_length=30)

    class Meta:
        managed = False
        db_table = 'emp_reg_info'


class LegacyEmployeeComplianceTracker(models.Model):
    emp_compliance_tracker_id = models.PositiveIntegerField(primary_key=True)
    emp_id = models.PositiveIntegerField()
    comp_type = models.CharField(max_length=120)
    status = models.CharField(max_length=40)
    doc_url = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'emp_compliance_tracker'


class LegacyEmployeeCtcInfo(models.Model):
    emp_ctc_id = models.PositiveIntegerField(primary_key=True)
    emp_id = models.PositiveIntegerField()
    int_title = models.CharField(max_length=60, null=True, blank=True)
    ext_title = models.CharField(max_length=120, null=True, blank=True)
    main_level = models.IntegerField(null=True, blank=True)
    sub_level = models.CharField(max_length=10, null=True, blank=True)
    start_of_ctc = models.DateField()
    end_of_ctc = models.DateField(null=True, blank=True)
    ctc_amt = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        managed = False
        db_table = 'emp_ctc_info'


class HrEmployeeDocument(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ]

    emp_id = models.PositiveIntegerField()
    doc_type = models.CharField(max_length=80)
    file = models.FileField(upload_to='hr_documents/')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True, default='')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hr_employee_documents'
        ordering = ['-uploaded_at']


class HrAlert(models.Model):
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    emp_id = models.PositiveIntegerField()
    alert_type = models.CharField(max_length=80)
    message = models.CharField(max_length=255)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')
    due_date = models.DateField(null=True, blank=True)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hr_alerts'
        ordering = ['is_resolved', '-created_at']


class HrExitWorkflow(models.Model):
    CLEARANCE_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]

    emp_id = models.PositiveIntegerField(unique=True)
    last_working_day = models.DateField()
    clearance_status = models.CharField(max_length=20, choices=CLEARANCE_CHOICES, default='pending')
    final_settlement_done = models.BooleanField(default=False)
    remarks = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hr_exit_workflows'


class HrRoleCtcChange(models.Model):
    emp_id = models.PositiveIntegerField()
    role = models.CharField(max_length=100)
    level = models.CharField(max_length=30)
    ctc_amount = models.PositiveIntegerField()
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    remarks = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hr_role_ctc_changes'
        ordering = ['emp_id', '-start_date', '-created_at']


class HrOnboardingChecklist(models.Model):
    emp_id = models.PositiveIntegerField()
    item_name = models.CharField(max_length=120)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    document = models.FileField(upload_to='hr_onboarding_docs/', null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hr_onboarding_checklist'
        ordering = ['emp_id', 'id']
