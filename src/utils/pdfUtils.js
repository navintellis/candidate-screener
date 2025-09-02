import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import { loadConfig } from './load-config.js';

const config = loadConfig();

/**
 * Generate HTML template for candidate profile
 * @param {Object} candidateProfile - Candidate profile JSON data
 * @param {Object} metadata - Processing metadata
 * @returns {string} HTML content
 */
function generateHTML(candidateProfile, metadata) {
  const generatedAt = moment().tz(config.timezone).format('MMMM DD, YYYY [at] HH:mm:ss z');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Candidate Profile - ${candidateProfile.candidate_name || 'Unknown'}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #fff;
        }
        
        h1 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        
        h2 {
            color: #34495e;
            margin-top: 30px;
            margin-bottom: 15px;
            border-left: 4px solid #3498db;
            padding-left: 10px;
        }
        
        h3 {
            color: #2c3e50;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        
        h4 {
            color: #34495e;
            margin-top: 15px;
            margin-bottom: 8px;
        }
        
        .metadata {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 20px;
            font-size: 0.9em;
            color: #666;
        }
        
        ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        ul ul {
            margin: 5px 0;
            padding-left: 20px;
        }
        
        li {
            margin: 5px 0;
        }
        
        .info-section {
            margin: 15px 0;
        }
        
        .info-item {
            margin: 8px 0;
        }
        
        .info-label {
            font-weight: bold;
            display: inline-block;
            min-width: 150px;
        }
        
        .summary-box {
            background: #f0f8ff;
            padding: 15px;
            border-left: 4px solid #3498db;
            margin: 15px 0;
        }
        
        .risk-section {
            background: #fff5f5;
            padding: 15px;
            border-left: 4px solid #e74c3c;
            margin: 15px 0;
        }
        
        @media print {
            body {
                padding: 10px;
            }
        }
    </style>
</head>
<body>
    <h1>Candidate Profile Report</h1>
    
    <div class="metadata">
        <strong>Generated:</strong> ${generatedAt}<br>
        <strong>Candidate ID:</strong> ${metadata.candidateId || 'N/A'}<br>
        <strong>Session:</strong> ${metadata.sessionId || 'N/A'}
    </div>

    <h2>1. Personal Information</h2>
    <div class="info-section">
        <div class="info-item">
            <span class="info-label">Full Name:</span> ${candidateProfile.candidate_name || 'Not Available'}
        </div>
        <div class="info-item">
            <span class="info-label">Current Role:</span> ${candidateProfile.current_role || 'Not Available'}
        </div>
        <div class="info-item">
            <span class="info-label">Total Experience:</span> ${candidateProfile.total_experience_years ? candidateProfile.total_experience_years + ' years' : 'Not Available'}
        </div>
        <div class="info-item">
            <span class="info-label">Notice Period:</span> ${candidateProfile.notice_period || 'Not Available'}
        </div>
        <div class="info-item">
            <span class="info-label">Availability:</span> ${candidateProfile.availability || 'Not Available'}
        </div>
        <div class="info-item">
            <span class="info-label">Salary Expectation:</span> ${candidateProfile.salary_expectation || 'Not Available'}
        </div>
    </div>
    
    <h3>1.1 Contact Information</h3>
    <div class="info-section">
        <div class="info-item">
            <span class="info-label">Email:</span> ${candidateProfile.contact?.email || 'Not Available'}
        </div>
        <div class="info-item">
            <span class="info-label">Phone:</span> ${candidateProfile.contact?.phone || 'Not Available'}
        </div>
        <div class="info-item">
            <span class="info-label">Location:</span> ${candidateProfile.contact?.location || 'Not Available'}
        </div>
    </div>

    <h2>2. Professional Summary</h2>
    <div class="summary-box">
        <p>${candidateProfile.summary || 'Not Available'}</p>
    </div>

    <h2>3. Strengths</h2>
    ${candidateProfile.strengths && candidateProfile.strengths.length > 0 ? `
    <ul>
        ${candidateProfile.strengths.map(strength => `<li>${strength}</li>`).join('')}
    </ul>
    ` : '<p>Not Available</p>'}

    <h2>4. Technical Skills & Expertise</h2>
    ${candidateProfile.skills && candidateProfile.skills.length > 0 ? `
    <ul>
        ${candidateProfile.skills.map(skill => `
            <li><strong>${skill.name}</strong>
                ${skill.level || skill.years || skill.last_used || (skill.tools && skill.tools.length > 0) || (skill.projects && skill.projects.length > 0) ? `
                <ul>
                    ${skill.level ? `<li>Level: ${skill.level}</li>` : ''}
                    ${skill.years ? `<li>Experience: ${skill.years} years</li>` : ''}
                    ${skill.last_used ? `<li>Last Used: ${skill.last_used}</li>` : ''}
                    ${skill.tools && skill.tools.length > 0 ? `<li>Tools: ${skill.tools.join(', ')}</li>` : ''}
                    ${skill.projects && skill.projects.length > 0 ? `<li>Projects: ${skill.projects.join(', ')}</li>` : ''}
                </ul>
                ` : ''}
            </li>
        `).join('')}
    </ul>
    ` : '<p>Not Available</p>'}

    <h2>5. Professional Experience</h2>
    ${candidateProfile.roles && candidateProfile.roles.length > 0 ? `
    ${candidateProfile.roles.map((role, index) => `
        <h3>5.${index + 1} ${role.title || 'Position not specified'}</h3>
        <div class="info-section">
            <div class="info-item">
                <span class="info-label">Company:</span> ${role.company || 'Not Available'}
            </div>
            <div class="info-item">
                <span class="info-label">Duration:</span> ${role.start || 'Not Available'} - ${role.end || 'Present'}
            </div>
        </div>
        ${role.responsibilities && role.responsibilities.length > 0 ? `
        <h4>Key Responsibilities:</h4>
        <ul>
            ${role.responsibilities.map(resp => `<li>${resp}</li>`).join('')}
        </ul>
        ` : '<p>Not Available</p>'}
    `).join('')}
    ` : '<p>Not Available</p>'}

    <h2>6. Current & Previous Employers</h2>
    ${candidateProfile.employers && candidateProfile.employers.length > 0 ? `
    <ul>
        ${candidateProfile.employers.map(employer => `<li>${employer}</li>`).join('')}
    </ul>
    ` : '<p>Not Available</p>'}

    <h2>7. Internships</h2>
    ${candidateProfile.internships && candidateProfile.internships.length > 0 ? `
    <ul>
        ${candidateProfile.internships.map(internship => `<li>${internship}</li>`).join('')}
    </ul>
    ` : '<p>Not Available</p>'}

    <h2>8. Education</h2>
    ${candidateProfile.education && candidateProfile.education.length > 0 ? `
    <ul>
        ${candidateProfile.education.map(edu => `<li>${edu}</li>`).join('')}
    </ul>
    ` : '<p>Not Available</p>'}
    
    <h2>9. Certifications</h2>
    ${candidateProfile.certifications && candidateProfile.certifications.length > 0 ? `
    <ul>
        ${candidateProfile.certifications.map(cert => `<li>${cert}</li>`).join('')}
    </ul>
    ` : '<p>Not Available</p>'}
    
    <h2>10. Domain Expertise</h2>
    ${candidateProfile.domains && candidateProfile.domains.length > 0 ? `
    <ul>
        ${candidateProfile.domains.map(domain => `<li>${domain}</li>`).join('')}
    </ul>
    ` : '<p>Not Available</p>'}
    
    <h2>11. Languages Spoken</h2>
    ${candidateProfile.languages_spoken && candidateProfile.languages_spoken.length > 0 ? `
    <ul>
        ${candidateProfile.languages_spoken.map(lang => `<li>${lang}</li>`).join('')}
    </ul>
    ` : '<p>Not Available</p>'}

    <h2>12. Hobbies & Interests</h2>
    ${candidateProfile.hobbies && candidateProfile.hobbies.length > 0 ? `
    <ul>
        ${candidateProfile.hobbies.map(hobby => `<li>${hobby}</li>`).join('')}
    </ul>
    ` : '<p>Not Available</p>'}

    <h2>13. Risk Assessment</h2>
    ${candidateProfile.risk_flags && candidateProfile.risk_flags.length > 0 ? `
    <div class="risk-section">
        <h3>Identified Risk Factors</h3>
        <ul>
            ${candidateProfile.risk_flags.map(flag => `<li>${flag}</li>`).join('')}
        </ul>
    </div>
    ` : '<p>Not Available</p>'}
</body>
</html>`;
}

/**
 * Generate PDF from candidate profile JSON
 * @param {Object} candidateProfile - Candidate profile data
 * @param {Object} metadata - Processing metadata
 * @param {string} outputDir - Directory to save files (optional, for filesystem storage)
 * @returns {Promise<Object>} Generated files information
 */
export async function generateCandidatePDF(candidateProfile, metadata, outputDir = null) {
  try {
    console.log('📄 Generating HTML template...');
    
    // Generate HTML content
    const htmlContent = generateHTML(candidateProfile, metadata);
    
    // Generate filenames
    const timestamp = moment().tz(config.timezone).format('YYYYMMDD-HHmmss');
    const candidateName = candidateProfile.candidate_name 
      ? candidateProfile.candidate_name.replace(/[^a-zA-Z0-9]/g, '_')
      : 'candidate';
    
    const htmlFilename = `${candidateName}_profile_${timestamp}.html`;
    const pdfFilename = `${candidateName}_profile_${timestamp}.pdf`;
    
    let htmlPath, pdfPath, htmlBuffer, pdfBuffer;
    
    if (outputDir) {
      // Filesystem storage
      htmlPath = path.join(outputDir, htmlFilename);
      pdfPath = path.join(outputDir, pdfFilename);
      
      // Save HTML file
      await fs.promises.writeFile(htmlPath, htmlContent, 'utf8');
      console.log('💾 HTML file saved to filesystem');
    } else {
      // For S3 storage, we'll generate buffers
      htmlBuffer = Buffer.from(htmlContent, 'utf8');
    }
    
    console.log('🖨️ Converting HTML to PDF...');
    
    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set content and generate PDF
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    const pdfOptions = {
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    };
    
    if (outputDir) {
      // Save PDF to filesystem
      await page.pdf({
        ...pdfOptions,
        path: pdfPath
      });
      console.log('💾 PDF file saved to filesystem');
    } else {
      // Generate PDF buffer for S3
      pdfBuffer = await page.pdf(pdfOptions);
    }
    
    await browser.close();
    console.log('✅ PDF generation completed');
    
    return {
      html: {
        filename: htmlFilename,
        path: htmlPath,
        buffer: htmlBuffer,
        size: htmlBuffer ? htmlBuffer.length : (await fs.promises.stat(htmlPath)).size
      },
      pdf: {
        filename: pdfFilename,
        path: pdfPath,
        buffer: pdfBuffer,
        size: pdfBuffer ? pdfBuffer.length : (await fs.promises.stat(pdfPath)).size
      }
    };
    
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

export default generateCandidatePDF; 