import 'package:flutter/material.dart';

/// Static, mock program catalog used for demos.
///
/// This intentionally does NOT hit the Nest API yet. It mirrors the web workflow seed
/// so the mobile applicant experience lines up 1:1 with the social worker's
/// review side.
///
/// SOURCE OF TRUTH: web/client/src/lib/workflow/seed.ts → buildAics().
/// The AICS program below copies that step set's workflow stages and the 9
/// Application Form fields (FLD-F-1 … FLD-F-9) exactly (labels, types, options).
/// If the seed changes, update this file to match.

/// The kind of input a [ProgramField] collects.
enum FieldType { text, multiline, number, dropdown, date, toggle, file, consent }

/// A single input field on the Application Form.
class ProgramField {
  const ProgramField({
    required this.key,
    required this.label,
    this.type = FieldType.text,
    this.hint,
    this.helper,
    this.required = true,
    this.options = const [],
    this.defaultValue,
  });

  final String key;
  final String label;
  final FieldType type;
  final String? hint;
  final String? helper;
  final bool required;

  /// Only used when [type] is [FieldType.dropdown].
  final List<String> options;

  final String? defaultValue;
}

/// One page of the Application Form. AICS uses a single page holding all of the
/// seed's fields; the multi-stage journey is tracked by [Program.stages].
class ProgramStep {
  const ProgramStep({
    required this.title,
    this.subtitle,
    required this.fields,
  });

  final String title;
  final String? subtitle;
  final List<ProgramField> fields;
}

/// A stage in the program's approval workflow (mirrors seed `Step`s of the
/// step set: form → verify → review → disbursement).
class WorkflowStage {
  const WorkflowStage({required this.name, required this.type});

  final String name;

  /// 'form' | 'verify' | 'review' | 'disbursement'
  final String type;
}

/// A government assistance program the customer can apply to.
class Program {
  const Program({
    required this.id,
    required this.code,
    required this.name,
    required this.tagline,
    required this.description,
    required this.icon,
    required this.color,
    required this.stages,
    required this.steps,
  });

  final String id;
  final String code;
  final String name;
  final String tagline;
  final String description;
  final IconData icon;
  final Color color;

  /// The workflow stages the application moves through (the journey tracker).
  final List<WorkflowStage> stages;

  /// The Application Form pages (the "form" stage). AICS = one page.
  final List<ProgramStep> steps;
}

/// The mock catalog. AICS is fully fleshed out from the seed; the others are
/// lighter placeholders so the home grid looks populated during a demo.
const List<Program> kPrograms = [
  Program(
    id: 'aics',
    code: 'AKAP',
    name: 'Ayuda sa Kapos ang Kita Program (AKAP)',
    tagline: 'Cash assistance for low-income earners.',
    description:
        'AKAP provides cash assistance to low-income earners to help cover '
        'urgent needs. The social worker assesses eligibility and verifies '
        'each requirement before releasing the grant.',
    icon: Icons.volunteer_activism_outlined,
    color: Color(0xFF0040E7),
    // Workflow stages — copied from seed buildAics().steps.
    stages: [
      WorkflowStage(name: 'Application Form', type: 'form'),
      WorkflowStage(name: 'Identity Verification', type: 'verify'),
      WorkflowStage(name: 'Social Worker Review', type: 'review'),
      WorkflowStage(name: 'Cash Grant Disbursement', type: 'disbursement'),
    ],
    // Application Form — one page, holds the seed's 8 fields FLD-F-1 … FLD-F-8.
    steps: [
      ProgramStep(
        title: 'AKAP Application Form',
        subtitle:
            'Select the assistance type and upload the supporting documents. '
            'The social worker verifies each item during review.',
        fields: [
          // FLD-F-1 (select) — option labels/values from seed OPT-F-1 … OPT-F-3
          ProgramField(
            key: 'assistance_type',
            label: 'Type of assistance',
            type: FieldType.dropdown,
            helper: 'AKAP category being applied for',
            options: [
              'Medical Assistance',
              'Funeral Assistance',
              'Rice and Food Assistance',
            ],
            defaultValue: 'Medical Assistance',
          ),
          // FLD-F-2 (file)
          ProgramField(
            key: 'employment_contract',
            label: 'Employment Contract',
            type: FieldType.file,
            helper: 'Signed by the HR/Employer',
          ),
          // FLD-F-3 (file)
          ProgramField(
            key: 'coe',
            label: 'Certificate of Employment with Compensation (COE)',
            type: FieldType.file,
          ),
          // FLD-F-4 (file)
          ProgramField(
            key: 'itr_2316',
            label: 'Income Tax Return or BIR Form 2316',
            type: FieldType.file,
          ),
          // FLD-F-5 (file)
          ProgramField(
            key: 'social_case_summary',
            label: 'Social Case Summary',
            type: FieldType.file,
          ),
          // FLD-F-6 (file)
          ProgramField(
            key: 'notarized_affidavit',
            label: 'Notarized Affidavit',
            type: FieldType.file,
          ),
          // FLD-F-7 (file)
          ProgramField(
            key: 'other_documents',
            label: 'Other Supporting Documents',
            type: FieldType.file,
          ),
          // FLD-F-8 (checkbox)
          ProgramField(
            key: 'consent',
            label: 'I certify that the above information is true.',
            type: FieldType.consent,
          ),
        ],
      ),
    ],
  ),
  Program(
    id: 'sap',
    code: 'SAP',
    name: 'Social Amelioration Program',
    tagline: 'Emergency subsidy for low-income households.',
    description: 'Cash subsidy support for qualified low-income households.',
    icon: Icons.family_restroom_outlined,
    color: Color(0xFF0F6E56),
    stages: [
      WorkflowStage(name: 'Application Form', type: 'form'),
      WorkflowStage(name: 'Identity Verification', type: 'verify'),
      WorkflowStage(name: 'Social Worker Review', type: 'review'),
      WorkflowStage(name: 'Cash Grant Disbursement', type: 'disbursement'),
    ],
    steps: [
      ProgramStep(
        title: 'Application Form',
        fields: [
          ProgramField(key: 'head_name', label: 'Household head'),
          ProgramField(
            key: 'members',
            label: 'Number of household members',
            type: FieldType.number,
          ),
        ],
      ),
    ],
  ),
  Program(
    id: 'tupad',
    code: 'TUPAD',
    name: 'Emergency Employment (TUPAD)',
    tagline: 'Short-term wage employment for displaced workers.',
    description:
        'Community-based package providing temporary wage employment.',
    icon: Icons.work_outline,
    color: Color(0xFF185FA5),
    stages: [
      WorkflowStage(name: 'Application Form', type: 'form'),
      WorkflowStage(name: 'Identity Verification', type: 'verify'),
      WorkflowStage(name: 'Foreman Review', type: 'review'),
      WorkflowStage(name: 'Wage Disbursement', type: 'disbursement'),
    ],
    steps: [
      ProgramStep(
        title: 'Application Form',
        fields: [
          ProgramField(key: 'worker_name', label: 'Full name'),
          ProgramField(
            key: 'displacement_reason',
            label: 'Reason for displacement',
            type: FieldType.multiline,
          ),
        ],
      ),
    ],
  ),
];

Program? programById(String id) {
  for (final p in kPrograms) {
    if (p.id == id || p.code.toLowerCase() == id.toLowerCase()) return p;
  }
  return null;
}
