name: Pull Request
description: Submit changes to the project
title: "[PR] "
labels: []
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        ## Pull Request

        Thank you for contributing! Please fill out the details below.

  - type: input
    id: description
    attributes:
      label: PR Title
      description: A brief description of what this PR does
      placeholder: Summary of changes
    validations:
      required: true

  - type: textarea
    id: changes
    attributes:
      label: Changes Made
      description: List the changes made in this PR
      placeholder: |
        - Change 1
        - Change 2
        - Change 3
    validations:
      required: true

  - type: textarea
    id: testing
    attributes:
      label: Testing
      description: How was this tested?
      placeholder: Describe how you tested your changes...
    validations:
      required: false

  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      options:
        - label: My code follows the project's style guidelines
          required: true
        - label: I have performed a self-review of my code
          required: true
        - label: I have added tests for new functionality
          required: false
        - label: I have made corresponding changes to the documentation
          required: false
        - label: My changes generate no new warnings
          required: false