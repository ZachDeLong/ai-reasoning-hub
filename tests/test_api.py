"""Tests for Flask API endpoints - input validation and responses."""

import pytest
import re


class TestPapersEndpoint:
    """Tests for /api/papers endpoint."""

    def test_papers_returns_json(self, client):
        """GET /api/papers should return JSON response."""
        response = client.get('/api/papers')
        assert response.status_code == 200
        assert response.content_type == 'application/json'

    def test_papers_has_expected_structure(self, client):
        """Response should have papers array and pagination info."""
        response = client.get('/api/papers')
        data = response.get_json()

        assert 'papers' in data
        assert isinstance(data['papers'], list)
        assert 'results_count' in data
        assert 'total_pages' in data

    def test_search_parameter_truncated(self, client):
        """Search parameter should be truncated to max length."""
        # Send overly long search query
        long_search = 'a' * 500
        response = client.get(f'/api/papers?search={long_search}')

        # Should still succeed (truncated internally)
        assert response.status_code == 200

    def test_min_score_clamped(self, client):
        """minScore should be clamped to valid range."""
        # Test score too high
        response = client.get('/api/papers?minScore=100')
        assert response.status_code == 200

        # Test negative score
        response = client.get('/api/papers?minScore=-5')
        assert response.status_code == 200

    def test_page_parameter_non_negative(self, client):
        """Page parameter should not go negative - server handles gracefully."""
        response = client.get('/api/papers?page=-1')
        assert response.status_code == 200
        # Server should clamp negative page to 0 and return valid results
        data = response.get_json()
        assert 'papers' in data

    def test_filter_by_category(self, client):
        """Should filter papers by category."""
        response = client.get('/api/papers?category=Reasoning')
        assert response.status_code == 200

    def test_multiple_categories(self, client):
        """Should accept multiple category filters."""
        response = client.get('/api/papers?category=Reasoning&category=Multimodal')
        assert response.status_code == 200


class TestCategoriesEndpoint:
    """Tests for /api/categories endpoint."""

    def test_categories_returns_list(self, client):
        """GET /api/categories should return a list."""
        response = client.get('/api/categories')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)


class TestPdfProxyEndpoint:
    """Tests for /api/pdf/<arxiv_id> endpoint."""

    def test_valid_arxiv_id_format(self, client):
        """Valid arXiv ID format should be accepted."""
        # We can't actually fetch PDFs in tests, but we can verify the ID validation
        # A real arXiv ID would be like 2401.12345
        response = client.get('/api/pdf/2401.12345')
        # May fail to fetch but shouldn't be 400 (invalid format)
        assert response.status_code != 400 or b'Invalid arxiv ID' not in response.data

    def test_invalid_arxiv_id_rejected(self, client):
        """Invalid arXiv ID format should return 400."""
        response = client.get('/api/pdf/invalid-id')
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
        assert 'Invalid arxiv ID' in data['error']

    def test_sql_injection_in_arxiv_id_rejected(self, client):
        """SQL injection attempts should be rejected by ID validation."""
        response = client.get('/api/pdf/2401.12345; DROP TABLE papers;')
        assert response.status_code == 400

    def test_path_traversal_rejected(self, client):
        """Path traversal attempts should be rejected (404 or 400)."""
        response = client.get('/api/pdf/../../../etc/passwd')
        # Flask routing may return 404 for malformed paths, which is acceptable
        assert response.status_code in (400, 404)


class TestBibtexEndpoint:
    """Tests for /api/bibtex/<arxiv_id> endpoint."""

    def test_invalid_arxiv_id_rejected(self, client):
        """Invalid arXiv ID should return 400."""
        response = client.get('/api/bibtex/not-valid')
        assert response.status_code == 400

    def test_valid_id_format_accepted(self, client):
        """Valid arXiv ID format should not return 400."""
        response = client.get('/api/bibtex/2401.12345')
        # May return 404 if paper not in DB, but not 400
        assert response.status_code != 400


class TestExportEndpoint:
    """Tests for /api/export/csv endpoint."""

    def test_export_returns_csv(self, client):
        """GET /api/export/csv should return CSV content."""
        response = client.get('/api/export/csv')
        assert response.status_code == 200
        assert 'text/csv' in response.content_type

    def test_export_has_headers(self, client):
        """CSV export should have expected column headers."""
        response = client.get('/api/export/csv')
        content = response.data.decode('utf-8')

        # Check for expected headers
        assert 'arxiv_id' in content
        assert 'title' in content
        assert 'authors' in content


class TestArxivIdValidation:
    """Tests for arXiv ID pattern validation."""

    def test_valid_patterns(self, client):
        """Test various valid arXiv ID formats."""
        valid_ids = [
            '2401.12345',      # Standard format
            '2401.1234',       # 4-digit paper number
            '2401.12345v1',    # With version
            '2401.12345v12',   # Multi-digit version
        ]

        for arxiv_id in valid_ids:
            response = client.get(f'/api/pdf/{arxiv_id}')
            # Should not be rejected for format
            assert response.status_code != 400 or b'Invalid arxiv ID' not in response.data, \
                f"Valid ID {arxiv_id} was incorrectly rejected"

    def test_invalid_patterns(self, client):
        """Test various invalid arXiv ID formats."""
        invalid_ids = [
            ('abc.12345', 400),       # Non-numeric year/month
            ('240112345', 400),       # Missing dot
            ('2401.123', 400),        # Too short
            ('2401.123456789', 400),  # Too long
            ('2401.12345v', 400),     # Incomplete version
            ('../2401.12345', 404),   # Path traversal (Flask routing handles this)
            ('2401.12345; DROP TABLE', 400), # SQL injection
        ]

        for arxiv_id, expected_status in invalid_ids:
            response = client.get(f'/api/pdf/{arxiv_id}')
            assert response.status_code == expected_status, \
                f"Invalid ID {arxiv_id} returned {response.status_code}, expected {expected_status}"
