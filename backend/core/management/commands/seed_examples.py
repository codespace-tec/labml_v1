from django.core.management.base import BaseCommand
from django.conf import settings
from sklearn.datasets import load_iris, fetch_california_housing
import pandas as pd

from core.storage import upload_csv


class Command(BaseCommand):
    help = 'Faz upload dos datasets de exemplo para o Supabase Storage'

    def handle(self, *args, **options):
        self._seed_iris()
        self._seed_diabetes()
        self._seed_california_housing()
        self.stdout.write(self.style.SUCCESS('Datasets de exemplo enviados com sucesso.'))

    def _seed_iris(self):
        data = load_iris(as_frame=True)
        df = data.frame.rename(columns={
            'sepal length (cm)': 'sepal_length',
            'sepal width (cm)': 'sepal_width',
            'petal length (cm)': 'petal_length',
            'petal width (cm)': 'petal_width',
        })
        species_map = {0: 'setosa', 1: 'versicolor', 2: 'virginica'}
        df['species'] = df['target'].map(species_map)
        df = df.drop(columns=['target'])
        upload_csv(df.to_csv(index=False).encode(), 'examples/iris.csv')
        self.stdout.write('  [OK] Iris')

    def _seed_diabetes(self):
        csv_path = settings.BASE_DIR.parent / 'exemplo' / 'diabetes.csv'
        df = pd.read_csv(csv_path)
        upload_csv(df.to_csv(index=False).encode(), 'examples/diabetes.csv')
        self.stdout.write('  [OK] Diabetes')

    def _seed_california_housing(self):
        data = fetch_california_housing(as_frame=True)
        df = data.frame.rename(columns={'MedHouseVal': 'median_house_value'})
        upload_csv(df.to_csv(index=False).encode(), 'examples/california_housing.csv')
        self.stdout.write('  [OK] California Housing')
