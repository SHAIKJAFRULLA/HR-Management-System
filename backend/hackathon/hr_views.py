import json
import os
from collections import defaultdict
from datetime import date, datetime

from django.db.models import Q
from django.http import FileResponse, HttpRequest, JsonResponse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from .auth import ExternalAuthError, load_signed_session
from .models import (
    HrAlert,
    HrEmployeeDocument,
    HrExitWorkflow,
    HrOnboardingChecklist,
    HrRoleCtcChange,
    LegacyEmployeeComplianceTracker,
    LegacyEmployeeCtcInfo,
    LegacyEmployeeMaster,
)


def _json_body(request: HttpRequest) -> dict:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        return {}


def _parse_date(raw: str | None) -> date | None:
    value = (raw or '').strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _get_session_payload(request: HttpRequest) -> dict | None:
    auth_header = request.headers.get('Authorization') or ''
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ', 1)[1].strip()
    if not token:
        return None
    try:
        return load_signed_session(token)
    except ExternalAuthError:
        return None


def _require_auth(request: HttpRequest) -> JsonResponse | None:
    if _get_session_payload(request) is None:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    return None


def _employee_name(emp: LegacyEmployeeMaster) -> str:
    return ' '.join(part for part in [emp.first_name, emp.middle_name, emp.last_name] if part).strip()


def _latest_ctc_map() -> dict[int, LegacyEmployeeCtcInfo]:
    mapping: dict[int, LegacyEmployeeCtcInfo] = {}
    rows = LegacyEmployeeCtcInfo.objects.order_by('emp_id', '-start_of_ctc', '-emp_ctc_id')
    for row in rows:
        if row.emp_id not in mapping:
            mapping[row.emp_id] = row
    return mapping


def _compliance_rows_by_emp_ids(emp_ids: list[int]) -> dict[int, list[LegacyEmployeeComplianceTracker]]:
    grouped: dict[int, list[LegacyEmployeeComplianceTracker]] = defaultdict(list)
    if not emp_ids:
        return grouped
    rows = LegacyEmployeeComplianceTracker.objects.filter(emp_id__in=emp_ids).order_by(
        'emp_id', '-emp_compliance_tracker_id'
    )
    for row in rows:
        grouped[row.emp_id].append(row)
    return grouped


@method_decorator(csrf_exempt, name='dispatch')
class HrComplianceReportView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized

        status_filter = (request.GET.get('status') or '').strip().lower()
        type_filter = (request.GET.get('type') or '').strip().lower()
        emp_filter = (request.GET.get('emp_id') or '').strip()

        employees = {emp.emp_id: _employee_name(emp) for emp in LegacyEmployeeMaster.objects.all()}
        rows = LegacyEmployeeComplianceTracker.objects.all().order_by('-emp_compliance_tracker_id')
        if emp_filter.isdigit():
            rows = rows.filter(emp_id=int(emp_filter))

        payload = []
        for row in rows:
            comp_status = (row.status or '').strip()
            normalized_status = 'pending' if 'pend' in comp_status.lower() else (
                'compliant' if 'verif' in comp_status.lower() else 'non-compliant'
            )
            if status_filter and normalized_status != status_filter:
                continue
            if type_filter and type_filter not in (row.comp_type or '').lower():
                continue
            payload.append(
                {
                    'emp_id': row.emp_id,
                    'employee_name': employees.get(row.emp_id, 'Not available'),
                    'document_type': row.comp_type,
                    'status': normalized_status,
                    'raw_status': row.status,
                    'doc_url': row.doc_url,
                }
            )
        return JsonResponse(payload, safe=False)


@method_decorator(csrf_exempt, name='dispatch')
class HrCtcAnalyticsView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized

        latest_map = _latest_ctc_map()
        bands = {'120k-300k': 0, '300k-700k': 0, '700k-1200k': 0}
        levels = defaultdict(int)
        for row in latest_map.values():
            ctc = int(row.ctc_amt or 0)
            if ctc <= 300000:
                bands['120k-300k'] += 1
            elif ctc <= 700000:
                bands['300k-700k'] += 1
            else:
                bands['700k-1200k'] += 1
            levels[f"L{row.main_level}-{row.sub_level}"] += 1

        return JsonResponse(
            {
                'salary_bands': [{'band': k, 'count': v} for k, v in bands.items()],
                'level_distribution': [{'level': k, 'count': v} for k, v in sorted(levels.items())],
            }
        )


@method_decorator(csrf_exempt, name='dispatch')
class HrJoinersLeaversView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized

        start = _parse_date(request.GET.get('start'))
        end = _parse_date(request.GET.get('end'))
        start = start or date.today().replace(month=1, day=1)
        end = end or date.today()

        month_data: dict[str, dict[str, int]] = defaultdict(lambda: {'joiners': 0, 'leavers': 0})
        for emp in LegacyEmployeeMaster.objects.filter(start_date__gte=start, start_date__lte=end):
            key = emp.start_date.strftime('%Y-%m')
            month_data[key]['joiners'] += 1
        for emp in LegacyEmployeeMaster.objects.filter(end_date__isnull=False, end_date__gte=start, end_date__lte=end):
            key = emp.end_date.strftime('%Y-%m')
            month_data[key]['leavers'] += 1

        rows = [{'month': month, **vals} for month, vals in sorted(month_data.items())]
        return JsonResponse(rows, safe=False)


@method_decorator(csrf_exempt, name='dispatch')
class HrHeadcountView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        total = LegacyEmployeeMaster.objects.count()
        active = LegacyEmployeeMaster.objects.filter(end_date__isnull=True).count()
        exited = total - active
        return JsonResponse({'total': total, 'active': active, 'exited': exited})


@method_decorator(csrf_exempt, name='dispatch')
class HrAlertsView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized

        unresolved = list(
            HrAlert.objects.filter(is_resolved=False).values(
                'id', 'emp_id', 'alert_type', 'message', 'severity', 'due_date', 'is_resolved'
            )
        )
        missing_compliance = []
        required = {'pan verification', 'aadhaar verification'}
        employees = list(LegacyEmployeeMaster.objects.all())
        compliance_by_emp = _compliance_rows_by_emp_ids([emp.emp_id for emp in employees])
        for emp in employees:
            types = {(row.comp_type or '').strip().lower() for row in compliance_by_emp.get(emp.emp_id, [])}
            missing = sorted(required - types)
            if missing:
                missing_compliance.append(
                    {
                        'emp_id': emp.emp_id,
                        'alert_type': 'compliance_gap',
                        'message': f"Missing: {', '.join(missing)}",
                        'severity': 'high',
                    }
                )
        return JsonResponse({'alerts': unresolved, 'dynamic_reminders': missing_compliance})

    def post(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        payload = _json_body(request)
        emp_id = int(payload.get('emp_id'))
        alert = HrAlert.objects.create(
            emp_id=emp_id,
            alert_type=(payload.get('alert_type') or 'manual').strip(),
            message=(payload.get('message') or '').strip(),
            severity=(payload.get('severity') or 'medium').strip(),
            due_date=_parse_date(payload.get('due_date')),
        )
        return JsonResponse({'id': alert.id, 'ok': True}, status=201)


@method_decorator(csrf_exempt, name='dispatch')
class HrComplianceDashboardView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized

        total = LegacyEmployeeMaster.objects.count()
        missing_docs = 0
        pending = 0
        gap_rows = []
        employees = list(LegacyEmployeeMaster.objects.all())
        compliance_by_emp = _compliance_rows_by_emp_ids([emp.emp_id for emp in employees])
        for emp in employees:
            comp_rows = compliance_by_emp.get(emp.emp_id, [])
            if not comp_rows:
                missing_docs += 1
                gap_rows.append({'emp_id': emp.emp_id, 'name': _employee_name(emp), 'gap': 'No compliance records'})
                continue
            for c in comp_rows:
                status = (c.status or '').lower()
                if 'pend' in status:
                    pending += 1
                    gap_rows.append({'emp_id': emp.emp_id, 'name': _employee_name(emp), 'gap': f'Pending {c.comp_type}'})

        metrics = {
            'total_employees': total,
            'missing_documents': missing_docs,
            'pending_verifications': pending,
            'compliance_gap_count': len(gap_rows),
        }
        return JsonResponse({'metrics': metrics, 'gaps': gap_rows[:100]})


@method_decorator(csrf_exempt, name='dispatch')
class HrEmployeeDocumentView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        emp = request.GET.get('emp_id')
        docs = HrEmployeeDocument.objects.all()
        if emp and emp.isdigit():
            docs = docs.filter(emp_id=int(emp))
        payload = [
            {
                'id': d.id,
                'emp_id': d.emp_id,
                'doc_type': d.doc_type,
                'status': d.status,
                'notes': d.notes,
                'uploaded_at': d.uploaded_at.isoformat(),
                'verified_at': d.verified_at.isoformat() if d.verified_at else None,
                'download_url': f'/api/hr/documents/{d.id}/download/',
            }
            for d in docs
        ]
        return JsonResponse(payload, safe=False)

    def post(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        raw_emp_id = (request.POST.get('emp_id') or '').strip()
        if not raw_emp_id.isdigit():
            return JsonResponse({'error': 'emp_id must be numeric'}, status=400)
        uploaded = request.FILES.get('file')
        if uploaded is None:
            return JsonResponse({'error': 'file is required'}, status=400)
        doc = HrEmployeeDocument.objects.create(
            emp_id=int(raw_emp_id),
            doc_type=(request.POST.get('doc_type') or 'general').strip(),
            file=uploaded,
            status='pending',
            notes=(request.POST.get('notes') or '').strip(),
        )
        return JsonResponse({'id': doc.id, 'ok': True}, status=201)


@method_decorator(csrf_exempt, name='dispatch')
class HrDocumentVerifyView(View):
    def post(self, request: HttpRequest, doc_id: int) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        payload = _json_body(request)
        try:
            doc = HrEmployeeDocument.objects.get(pk=doc_id)
        except HrEmployeeDocument.DoesNotExist:
            return JsonResponse({'error': 'Document not found'}, status=404)
        status_value = (payload.get('status') or '').strip().lower()
        if status_value not in {'pending', 'verified', 'rejected'}:
            return JsonResponse({'error': 'Invalid status'}, status=400)
        doc.status = status_value
        doc.notes = (payload.get('notes') or doc.notes).strip()
        doc.verified_at = timezone.now() if status_value == 'verified' else None
        doc.save(update_fields=['status', 'notes', 'verified_at'])
        return JsonResponse({'ok': True})


@method_decorator(csrf_exempt, name='dispatch')
class HrDocumentDownloadView(View):
    def get(self, request: HttpRequest, doc_id: int):
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        try:
            doc = HrEmployeeDocument.objects.get(pk=doc_id)
        except HrEmployeeDocument.DoesNotExist:
            return JsonResponse({'error': 'Document not found'}, status=404)
        return FileResponse(doc.file.open('rb'), as_attachment=True, filename=doc.file.name.split('/')[-1])


@method_decorator(csrf_exempt, name='dispatch')
class HrExitWorkflowView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        emp = request.GET.get('emp_id')
        qs = HrExitWorkflow.objects.all()
        if emp and emp.isdigit():
            qs = qs.filter(emp_id=int(emp))
        payload = [
            {
                'emp_id': x.emp_id,
                'last_working_day': x.last_working_day.isoformat(),
                'clearance_status': x.clearance_status,
                'final_settlement_done': x.final_settlement_done,
                'remarks': x.remarks,
            }
            for x in qs
        ]
        return JsonResponse(payload, safe=False)

    def post(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        payload = _json_body(request)
        raw_emp = (payload.get('emp_id') or '').strip()
        if not raw_emp.isdigit():
            return JsonResponse({'error': 'emp_id must be numeric'}, status=400)
        lwd = _parse_date(payload.get('last_working_day'))
        if not lwd:
            return JsonResponse({'error': 'last_working_day is required'}, status=400)
        workflow, _ = HrExitWorkflow.objects.update_or_create(
            emp_id=int(raw_emp),
            defaults={
                'last_working_day': lwd,
                'clearance_status': (payload.get('clearance_status') or 'pending').strip(),
                'final_settlement_done': bool(payload.get('final_settlement_done')),
                'remarks': (payload.get('remarks') or '').strip(),
            },
        )
        LegacyEmployeeMaster.objects.filter(emp_id=workflow.emp_id).update(end_date=lwd)
        return JsonResponse({'ok': True})


@method_decorator(csrf_exempt, name='dispatch')
class HrRoleCtcHistoryView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        emp = request.GET.get('emp_id')
        qs = HrRoleCtcChange.objects.all()
        if emp and emp.isdigit():
            qs = qs.filter(emp_id=int(emp))
        payload = [
            {
                'id': row.id,
                'emp_id': row.emp_id,
                'role': row.role,
                'level': row.level,
                'ctc_amount': row.ctc_amount,
                'start_date': row.start_date.isoformat(),
                'end_date': row.end_date.isoformat() if row.end_date else None,
                'remarks': row.remarks,
            }
            for row in qs
        ]
        return JsonResponse(payload, safe=False)

    def post(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        payload = _json_body(request)
        raw_emp = (payload.get('emp_id') or '').strip()
        if not raw_emp.isdigit():
            return JsonResponse({'error': 'emp_id must be numeric'}, status=400)
        start = _parse_date(payload.get('start_date'))
        end = _parse_date(payload.get('end_date'))
        if not start:
            return JsonResponse({'error': 'start_date is required'}, status=400)
        if end and end < start:
            return JsonResponse({'error': 'end_date cannot be before start_date'}, status=400)

        emp_id = int(raw_emp)
        overlap = HrRoleCtcChange.objects.filter(emp_id=emp_id).filter(
            Q(end_date__isnull=True, start_date__lte=(end or date(9999, 12, 31)))
            | Q(end_date__isnull=False, end_date__gte=start, start_date__lte=(end or date(9999, 12, 31)))
        )
        if overlap.exists():
            return JsonResponse({'error': 'Role/CTC date range overlaps with existing entry'}, status=400)

        row = HrRoleCtcChange.objects.create(
            emp_id=emp_id,
            role=(payload.get('role') or '').strip(),
            level=(payload.get('level') or '').strip(),
            ctc_amount=int(payload.get('ctc_amount') or 0),
            start_date=start,
            end_date=end,
            remarks=(payload.get('remarks') or '').strip(),
        )
        return JsonResponse({'id': row.id, 'ok': True}, status=201)


DEFAULT_ONBOARDING_ITEMS = ['Offer Letter Signed', 'ID Verification', 'Policy Acknowledgement']


@method_decorator(csrf_exempt, name='dispatch')
class HrOnboardingView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        emp = request.GET.get('emp_id')
        qs = HrOnboardingChecklist.objects.all()
        if emp and emp.isdigit():
            qs = qs.filter(emp_id=int(emp))

        items = [
            {
                'id': row.id,
                'emp_id': row.emp_id,
                'item_name': row.item_name,
                'is_completed': row.is_completed,
                'completed_at': row.completed_at.isoformat() if row.completed_at else None,
                'document_url': row.document.url if row.document else None,
                'notes': row.notes,
            }
            for row in qs
        ]

        summary = []
        grouped: dict[int, list[HrOnboardingChecklist]] = defaultdict(list)
        for row in qs:
            grouped[row.emp_id].append(row)
        for emp_id, rows in grouped.items():
            total = len(rows)
            completed = len([x for x in rows if x.is_completed])
            progress = int((completed / total) * 100) if total else 0
            summary.append({'emp_id': emp_id, 'completed': completed, 'total': total, 'progress': progress})

        return JsonResponse({'items': items, 'summary': summary})

    def post(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized

        if request.content_type and request.content_type.startswith('multipart/form-data'):
            raw_emp = (request.POST.get('emp_id') or '').strip()
            item_name = (request.POST.get('item_name') or '').strip()
            is_completed = (request.POST.get('is_completed') or '').strip().lower() == 'true'
            notes = (request.POST.get('notes') or '').strip()
            row_id = request.POST.get('id')
            if row_id:
                row = HrOnboardingChecklist.objects.get(pk=int(row_id))
                row.is_completed = is_completed
                row.notes = notes
                if request.FILES.get('document'):
                    row.document = request.FILES['document']
                row.completed_at = timezone.now() if is_completed else None
                row.save()
                return JsonResponse({'ok': True})
            if not raw_emp.isdigit() or not item_name:
                return JsonResponse({'error': 'emp_id and item_name are required'}, status=400)
            row = HrOnboardingChecklist.objects.create(
                emp_id=int(raw_emp),
                item_name=item_name,
                is_completed=is_completed,
                completed_at=timezone.now() if is_completed else None,
                document=request.FILES.get('document'),
                notes=notes,
            )
            return JsonResponse({'id': row.id, 'ok': True}, status=201)

        payload = _json_body(request)
        raw_emp = (payload.get('emp_id') or '').strip()
        if not raw_emp.isdigit():
            return JsonResponse({'error': 'emp_id must be numeric'}, status=400)
        item_name = (payload.get('item_name') or '').strip()
        if not item_name:
            return JsonResponse({'error': 'item_name is required'}, status=400)
        row = HrOnboardingChecklist.objects.create(
            emp_id=int(raw_emp),
            item_name=item_name,
            is_completed=bool(payload.get('is_completed')),
            completed_at=timezone.now() if payload.get('is_completed') else None,
            notes=(payload.get('notes') or '').strip(),
        )
        return JsonResponse({'id': row.id, 'ok': True}, status=201)


@method_decorator(csrf_exempt, name='dispatch')
class HrOnboardingBootstrapView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        payload = _json_body(request)
        raw_emp = (payload.get('emp_id') or '').strip()
        if not raw_emp.isdigit():
            return JsonResponse({'error': 'emp_id must be numeric'}, status=400)
        emp_id = int(raw_emp)
        for item in DEFAULT_ONBOARDING_ITEMS:
            HrOnboardingChecklist.objects.get_or_create(emp_id=emp_id, item_name=item)
        return JsonResponse({'ok': True})


@method_decorator(csrf_exempt, name='dispatch')
class HrDashboardView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        headcount = {
            'total': LegacyEmployeeMaster.objects.count(),
            'active': LegacyEmployeeMaster.objects.filter(end_date__isnull=True).count(),
        }
        headcount['exited'] = headcount['total'] - headcount['active']
        pending_docs = HrEmployeeDocument.objects.filter(status='pending').count()
        unresolved_alerts = HrAlert.objects.filter(is_resolved=False).count()
        onboarding_items = HrOnboardingChecklist.objects.count()
        onboarding_completed = HrOnboardingChecklist.objects.filter(is_completed=True).count()
        onboarding_progress = int((onboarding_completed / onboarding_items) * 100) if onboarding_items else 0
        return JsonResponse(
            {
                'headcount': headcount,
                'pending_documents': pending_docs,
                'unresolved_alerts': unresolved_alerts,
                'onboarding_progress': onboarding_progress,
            }
        )


@method_decorator(csrf_exempt, name='dispatch')
class HrAccessVerifyView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_auth(request)
        if unauthorized:
            return unauthorized
        payload = _json_body(request)
        entered_user = (payload.get('username') or '').strip()
        entered = (payload.get('password') or '').strip()
        expected_user = os.getenv('HR_MODULES_USERNAME', 'jafru')
        expected = os.getenv('HR_MODULES_PASSWORD', '897676')
        if not entered_user or not entered:
            return JsonResponse({'error': 'Username and password are required'}, status=400)
        if entered_user != expected_user or entered != expected:
            return JsonResponse({'error': 'Invalid HR access credentials'}, status=401)
        return JsonResponse({'ok': True})
