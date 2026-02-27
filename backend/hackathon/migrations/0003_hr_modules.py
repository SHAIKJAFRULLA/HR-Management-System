from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hackathon', '0002_employee'),
    ]

    operations = [
        migrations.CreateModel(
            name='HrEmployeeDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('emp_id', models.PositiveIntegerField()),
                ('doc_type', models.CharField(max_length=80)),
                ('file', models.FileField(upload_to='hr_documents/')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('verified', 'Verified'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('notes', models.TextField(blank=True, default='')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={'db_table': 'hr_employee_documents', 'ordering': ['-uploaded_at']},
        ),
        migrations.CreateModel(
            name='HrAlert',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('emp_id', models.PositiveIntegerField()),
                ('alert_type', models.CharField(max_length=80)),
                ('message', models.CharField(max_length=255)),
                ('severity', models.CharField(choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High')], default='medium', max_length=20)),
                ('due_date', models.DateField(blank=True, null=True)),
                ('is_resolved', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'hr_alerts', 'ordering': ['is_resolved', '-created_at']},
        ),
        migrations.CreateModel(
            name='HrExitWorkflow',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('emp_id', models.PositiveIntegerField(unique=True)),
                ('last_working_day', models.DateField()),
                ('clearance_status', models.CharField(choices=[('pending', 'Pending'), ('in_progress', 'In Progress'), ('completed', 'Completed')], default='pending', max_length=20)),
                ('final_settlement_done', models.BooleanField(default=False)),
                ('remarks', models.TextField(blank=True, default='')),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'hr_exit_workflows'},
        ),
        migrations.CreateModel(
            name='HrRoleCtcChange',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('emp_id', models.PositiveIntegerField()),
                ('role', models.CharField(max_length=100)),
                ('level', models.CharField(max_length=30)),
                ('ctc_amount', models.PositiveIntegerField()),
                ('start_date', models.DateField()),
                ('end_date', models.DateField(blank=True, null=True)),
                ('remarks', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'hr_role_ctc_changes', 'ordering': ['emp_id', '-start_date', '-created_at']},
        ),
        migrations.CreateModel(
            name='HrOnboardingChecklist',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('emp_id', models.PositiveIntegerField()),
                ('item_name', models.CharField(max_length=120)),
                ('is_completed', models.BooleanField(default=False)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('document', models.FileField(blank=True, null=True, upload_to='hr_onboarding_docs/')),
                ('notes', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'hr_onboarding_checklist', 'ordering': ['emp_id', 'id']},
        ),
    ]
