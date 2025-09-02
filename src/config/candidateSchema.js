export const candidateProfileSchema = {
  name: "CandidateProfile",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "skills"],
    properties: {
      candidate_name: { type: "string", description: "Candidate's full name if mentioned" },
      contact: {
        type: "object",
        additionalProperties: false,
        properties: {
          email: { type: "string" },
          phone: { type: "string" },
          location: { type: "string" }
        }
      },
      total_experience_years: { type: "number" },
      current_role: { type: "string" },
      notice_period: { type: "string" },
      availability: { type: "string", description: "When they can join / interview" },
      salary_expectation: { type: "string" },
      domains: { type: "array", items: { type: "string" } },
      certifications: { type: "array", items: { type: "string" } },
      education: { type: "array", items: { type: "string" } },
      employers: { type: "array", items: { type: "string", description: "Companies where the candidate has worked as contracts/freelancing/full-time. Mention the details of the employment like duration, role, etc. and the company/institute/client they have been working for and the duration they were working for" } },
      internships: { type: "array", items: { type: "string", description: "Companies/Institutions/Colleges where the candidate has worked as intern. Mention the details of the internship like duration, role, etc. and the company/mentor/team they have been working under and the duration they were working for" } },
      languages_spoken: { type: "array", items: { type: "string" } },
      hobbies: { type: "array", items: { type: "string" } },
      roles: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            company: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
            responsibilities: { type: "array", items: { type: "string" } }
          }
        }
      },
      skills: {
        type: "array",
        description: "Key skills mentioned by the candidate",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: {
            name: { type: "string" },
            level: { type: "string", enum: ["beginner","intermediate","advanced","expert"], nullable: true },
            years: { type: "number", nullable: true },
            last_used: { type: "string", nullable: true },
            tools: { type: "array", items: { type: "string" }, nullable: true },
            projects: { type: "array", items: { type: "string" }, nullable: true }
          }
        }
      },
      summary: { type: "string", description: "3–5 line summary of profile" },
      strengths: {
        type: "array",
        items: { type: "string" },
        description: "Positives traits, strengths, goals, visions, achievements, etc.(anything valuable which is not covered in skills sections)"
      },
      risk_flags: {
        type: "array",
        items: { type: "string" },
        description: "Optional concerns (notice period too long, skill mismatch, etc.)"
      }
    }
  }
}; 